import type { Tap } from "./taps";
import type { Lanes } from "../types/recordings.types";

export interface Issue {
  t: number;
  kind: "error" | "request" | "rage" | "report";
  label: string;
}

/** A shake and the report its prompt sends are one report, not two. */
const REPORT_MERGE_MS = 120_000;

/** The moments worth jumping to, in time order: errors, failed requests, rage taps and reports. */
export function issuesOf(lanes: Lanes, rage: readonly Tap[]): Issue[] {
  const issues: Issue[] = [];
  for (const entry of lanes.console) {
    if (entry.level === "error") issues.push({ t: entry.t, kind: "error", label: entry.text });
  }
  for (const entry of lanes.telemetry) {
    if (entry.kind === "error") issues.push({ t: entry.t, kind: "error", label: entry.name });
  }
  for (const entry of lanes.network) {
    if (entry.error !== null || (entry.status ?? 0) >= 400) {
      issues.push({
        t: entry.t,
        kind: "request",
        label: `${entry.method} ${entry.url} → ${entry.status ?? entry.error ?? "failed"}`,
      });
    }
  }
  for (const tap of rage) issues.push({ t: tap.t, kind: "rage", label: "Rage tap" });
  let lastReport = Number.NEGATIVE_INFINITY;
  for (const marker of lanes.markers) {
    if (
      marker.kind === "trigger" &&
      (marker.data.trigger === "shake" || marker.data.trigger === "manual")
    ) {
      if (marker.t - lastReport < REPORT_MERGE_MS) continue;
      lastReport = marker.t;
      issues.push({ t: marker.t, kind: "report", label: marker.label });
    } else if (marker.kind === "database-unavailable") {
      issues.push({ t: marker.t, kind: "error", label: marker.label });
    }
  }
  return issues.sort((a, b) => a.t - b.t);
}

/** The next issue after `time`, or the previous one before it; a small margin skips the one at the playhead. */
export function adjacentIssue(
  issues: readonly Issue[],
  time: number,
  direction: 1 | -1,
): Issue | null {
  const margin = 400;
  if (direction === 1) return issues.find((issue) => issue.t > time + margin) ?? null;
  for (let index = issues.length - 1; index >= 0; index--) {
    if (issues[index]!.t < time - margin) return issues[index]!;
  }
  return null;
}
