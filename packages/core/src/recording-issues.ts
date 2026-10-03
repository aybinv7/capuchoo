/**
 * Errors grouped across sessions. The device fingerprints each error it records and sends the
 * fingerprints with the segment's metadata, so the server can count them without opening a segment.
 */
import { fnv1a } from "./hash.js";

export interface RecordingIssue {
  fingerprint: string;
  /** The error message with its variable parts (numbers, ids, urls) replaced. */
  message: string;
  /** The topmost stack frame as recorded, minified; the dashboard resolves it with source maps. */
  frame: string | null;
  /** Occurrences in the segment. */
  count: number;
  /** Wall clock of the first occurrence in the segment. */
  at: number;
}

export const RECORDING_ISSUE_LIMITS = { perSegment: 5, message: 200, frame: 300 } as const;

const PREFIXES = /^(?:uncaught (?:\(in promise\) )?|unhandled rejection )/i;
const VARIABLE_PARTS: Array<[RegExp, string]> = [
  [/\bhttps?:\/\/\S+/g, "<url>"],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "<id>"],
  [/\b0x[0-9a-f]+\b/gi, "<n>"],
  [/\b[0-9a-f]{16,}\b/gi, "<id>"],
  [/\b\d+(?:\.\d+)?\b/g, "<n>"],
];
const FRAME = /(?:\(|@|\bat )((?:https?|capacitor|file):\/\/[^\s)]+?):(\d+):(\d+)\)?\s*$/;

/** The message an error groups under: no prefix, no numbers, ids or urls, whitespace collapsed. */
export function normaliseIssueMessage(text: string): string {
  let message = (text.split(/\r?\n/, 1)[0] ?? "").replace(PREFIXES, "").trim();
  for (const [pattern, replacement] of VARIABLE_PARTS) {
    message = message.replace(pattern, replacement);
  }
  return message.replace(/\s+/g, " ").slice(0, RECORDING_ISSUE_LIMITS.message);
}

/** The first frame of a stack that points into a script, as the line it was recorded on. */
export function topFrame(stack: string | null): string | null {
  if (!stack) return null;
  for (const line of stack.split(/\r?\n/)) {
    if (FRAME.test(line)) return line.trim().slice(0, RECORDING_ISSUE_LIMITS.frame);
  }
  return null;
}

/** The script a frame runs in, without the build hash, so one bug keeps its group across builds. */
function scriptOf(frame: string | null): string {
  const match = frame ? FRAME.exec(frame) : null;
  if (!match) return "";
  const path = match[1]!.replace(/^[a-z]+:\/\/[^/]+/i, "").replace(/[?#].*$/, "");
  return path.replace(/-[A-Za-z0-9_-]{8}(?=\.m?js$)/, "");
}

export function issueOf(
  text: string,
  stack: string | null,
): Pick<RecordingIssue, "fingerprint" | "message" | "frame"> {
  const message = normaliseIssueMessage(text) || "Error";
  const frame = topFrame(stack);
  return {
    fingerprint: fnv1a(`${message}|${scriptOf(frame)}`).toString(36),
    message,
    frame,
  };
}

export function parseRecordingIssues(input: unknown): RecordingIssue[] {
  if (!Array.isArray(input)) return [];
  const issues: RecordingIssue[] = [];
  for (const entry of input.slice(0, RECORDING_ISSUE_LIMITS.perSegment)) {
    if (!entry || typeof entry !== "object") continue;
    const raw = entry as Record<string, unknown>;
    if (typeof raw.fingerprint !== "string" || !/^[0-9a-z]{1,13}$/.test(raw.fingerprint)) continue;
    if (typeof raw.message !== "string" || !raw.message.trim()) continue;
    issues.push({
      fingerprint: raw.fingerprint,
      message: raw.message.trim().slice(0, RECORDING_ISSUE_LIMITS.message),
      frame:
        typeof raw.frame === "string" && raw.frame.trim()
          ? raw.frame.trim().slice(0, RECORDING_ISSUE_LIMITS.frame)
          : null,
      count:
        typeof raw.count === "number" && Number.isInteger(raw.count) && raw.count > 0
          ? Math.min(raw.count, 1_000_000)
          : 1,
      at: typeof raw.at === "number" && Number.isFinite(raw.at) ? raw.at : 0,
    });
  }
  return issues;
}
