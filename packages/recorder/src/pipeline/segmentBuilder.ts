import {
  RECORDING_ISSUE_LIMITS,
  issueOf,
  type RecordedEvent,
  type RecordingIssue,
} from "@capuchoo/core";
import {
  isErrorEvent,
  isReplayCheckout,
  isReplayFullSnapshot,
  serializeEvent,
} from "./serialize.js";

export const SEGMENT_TARGET_BYTES = 512 * 1024;

export interface ClosedSegment {
  text: string;
  startedAt: number;
  endedAt: number;
  events: number;
  bytes: number;
  errors: number;
  issues: RecordingIssue[];
  fullSnapshot: boolean;
}

/** What an error event says about itself, for grouping; null for anything that is not an error. */
function errorOf(event: RecordedEvent): { text: string; stack: string | null } | null {
  const data = event.d as { text?: unknown; message?: unknown; stack?: unknown } | null;
  const text = typeof data?.text === "string" ? data.text : data?.message;
  if (typeof text !== "string") return null;
  return { text, stack: typeof data?.stack === "string" ? data.stack : null };
}

/** Accumulates NDJSON lines until the segment is closed; serialization happens here, off the main thread. */
export class SegmentBuilder {
  #lines: string[] = [];
  #bytes = 0;
  #errors = 0;
  #issues = new Map<string, RecordingIssue>();
  #fullSnapshot = false;
  #startedAt = 0;
  #endedAt = 0;
  #openedAt = 0;

  get empty(): boolean {
    return this.#lines.length === 0;
  }

  get openedAt(): number {
    return this.#openedAt;
  }

  get bytes(): number {
    return this.#bytes;
  }

  /** True when this event starts a new replay checkout and the open segment should close first. */
  breaksBefore(event: RecordedEvent): boolean {
    return !this.empty && isReplayCheckout(event);
  }

  add(event: RecordedEvent, now: number): void {
    const line = serializeEvent(event);
    if (line === null) return;
    if (this.empty) {
      this.#startedAt = event.t;
      this.#openedAt = now;
    }
    this.#lines.push(line);
    this.#bytes += line.length + 1;
    this.#startedAt = Math.min(this.#startedAt, event.t);
    this.#endedAt = Math.max(this.#endedAt, event.t);
    if (isErrorEvent(event)) {
      this.#errors++;
      this.#noteIssue(event);
    }
    if (isReplayFullSnapshot(event)) this.#fullSnapshot = true;
  }

  #noteIssue(event: RecordedEvent): void {
    const error = errorOf(event);
    if (!error) return;
    const issue = issueOf(error.text, error.stack);
    const known = this.#issues.get(issue.fingerprint);
    if (known) known.count++;
    else if (this.#issues.size < RECORDING_ISSUE_LIMITS.perSegment) {
      this.#issues.set(issue.fingerprint, { ...issue, count: 1, at: event.t });
    }
  }

  get full(): boolean {
    return this.#bytes >= SEGMENT_TARGET_BYTES;
  }

  close(): ClosedSegment | null {
    if (this.empty) return null;
    const segment: ClosedSegment = {
      text: `${this.#lines.join("\n")}\n`,
      startedAt: this.#startedAt,
      endedAt: Math.max(this.#endedAt, this.#startedAt),
      events: this.#lines.length,
      bytes: this.#bytes,
      errors: this.#errors,
      issues: [...this.#issues.values()],
      fullSnapshot: this.#fullSnapshot,
    };
    this.#lines = [];
    this.#bytes = 0;
    this.#errors = 0;
    this.#issues = new Map();
    this.#fullSnapshot = false;
    this.#startedAt = 0;
    this.#endedAt = 0;
    return segment;
  }
}
