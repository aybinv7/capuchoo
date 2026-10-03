import {
  escalateMode,
  modeRank,
  type RecordingMode,
  type RecordingStart,
  type ResolvedRecordingPolicy,
} from "@capuchoo/core";

export interface Escalation {
  mode: RecordingMode;
  until: number;
  start: RecordingStart;
}

/** The mode in force: the policy's baseline, raised by an unexpired escalation, never past the ceiling. */
export function effectiveMode(
  policy: Pick<ResolvedRecordingPolicy, "mode" | "ceiling"> | null,
  escalation: Escalation | null,
  now: number,
): RecordingMode {
  if (!policy) return "off";
  if (!escalation || escalation.until <= now) return policy.mode;
  return escalateMode(policy.mode, escalation.mode, policy.ceiling);
}

/** What started the session now in force: the escalation that raised it, or the policy. */
export function sessionStart(
  policy: Pick<ResolvedRecordingPolicy, "mode"> | null,
  escalation: Escalation | null,
  now: number,
): RecordingStart {
  if (!policy || !escalation || escalation.until <= now) return "policy";
  return modeRank(escalation.mode) > modeRank(policy.mode) ? escalation.start : "policy";
}

/** Merges a new escalation into the current one: the higher mode and the later deadline win. */
export function mergeEscalation(
  current: Escalation | null,
  next: Escalation,
  now: number,
): Escalation {
  if (!current || current.until <= now) return next;
  const higher = modeRank(next.mode) >= modeRank(current.mode);
  return {
    mode: higher ? next.mode : current.mode,
    until: Math.max(current.until, next.until),
    start: higher ? next.start : current.start,
  };
}

export type Transition =
  | { kind: "none" }
  | { kind: "begin" }
  | { kind: "end" }
  | { kind: "promote" }
  | { kind: "rotate" }
  | { kind: "retune" };

/** How to get from one mode to the next without losing the buffer or splitting a session needlessly. */
export function transition(from: RecordingMode, to: RecordingMode): Transition {
  if (from === to) return { kind: "none" };
  if (from === "off") return { kind: "begin" };
  if (to === "off") return { kind: "end" };
  if (from === "buffer") return { kind: "promote" };
  if (to === "buffer") return { kind: "rotate" };
  return { kind: "retune" };
}
