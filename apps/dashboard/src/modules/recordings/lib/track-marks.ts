import type { Issue } from "./issues";
import type { TimelineBounds } from "./timeline";
import type { LaneTone } from "./tones";

export interface TrackMark {
  id: string;
  /** Position on the track, 0..1. */
  at: number;
  tone: LaneTone;
  label: string;
}

const MARKER_TONES: Record<string, LaneTone> = {
  trigger: "primary",
  escalate: "primary",
  "replay-paused": "warning",
  "database-unsupported": "warning",
  "database-unavailable": "warning",
};

/**
 * What the scrubber's rail carries: every issue, and the markers that explain the recording itself.
 * Routes stay off it; they are in Activity, and on a busy session they would hide the issues. A
 * report is already its trigger marker, so it is drawn once.
 */
export function trackMarks(
  issues: readonly Issue[],
  markers: ReadonlyArray<{ id: string; at: number; kind: string; label: string }>,
  bounds: TimelineBounds,
): TrackMark[] {
  const span = Math.max(1, bounds.end - bounds.start);
  const marks: TrackMark[] = [];
  for (const marker of markers) {
    const tone = MARKER_TONES[marker.kind];
    if (tone) marks.push({ id: marker.id, at: marker.at, tone, label: marker.label });
  }
  issues.forEach((issue, index) => {
    if (issue.kind === "report") return;
    marks.push({
      id: `issue:${index}`,
      at: Math.min(1, Math.max(0, (issue.t - bounds.start) / span)),
      tone: "danger",
      label: issue.label.split(/\r?\n/)[0] ?? issue.label,
    });
  });
  return marks.sort((a, b) => a.at - b.at);
}

/** The marks within `reach` of a position, nearest first. */
export function marksNear(marks: readonly TrackMark[], at: number, reach: number): TrackMark[] {
  return marks
    .filter((mark) => Math.abs(mark.at - at) <= reach)
    .sort((a, b) => Math.abs(a.at - at) - Math.abs(b.at - at));
}
