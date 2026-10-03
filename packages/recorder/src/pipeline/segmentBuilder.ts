import type { RecordedEvent } from "@capuchoo/core";
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
  fullSnapshot: boolean;
}

/** Accumulates NDJSON lines until the segment is closed; serialization happens here, off the main thread. */
export class SegmentBuilder {
  #lines: string[] = [];
  #bytes = 0;
  #errors = 0;
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
    if (isErrorEvent(event)) this.#errors++;
    if (isReplayFullSnapshot(event)) this.#fullSnapshot = true;
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
      fullSnapshot: this.#fullSnapshot,
    };
    this.#lines = [];
    this.#bytes = 0;
    this.#errors = 0;
    this.#fullSnapshot = false;
    this.#startedAt = 0;
    this.#endedAt = 0;
    return segment;
  }
}
