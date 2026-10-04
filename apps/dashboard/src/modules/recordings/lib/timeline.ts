import type { Lanes } from "../types/recordings.types";
import type { LaneTone } from "@/shared/lib/tone-styles";

export interface TimelineTrack {
  key: string;
  label: string;
  /** Per bucket, 0..1, relative to the busiest bucket of this track. */
  density: number[];
  tone: LaneTone;
  /** Positions in 0..1 that deserve a mark of their own: failures, errors, triggers. */
  marks: Array<{ at: number; tone: LaneTone; label: string }>;
}

export interface TimelineBounds {
  start: number;
  end: number;
}

function buckets(times: Iterable<number>, bounds: TimelineBounds, count: number): number[] {
  const values = Array.from({ length: count }, () => 0);
  const span = Math.max(1, bounds.end - bounds.start);
  for (const time of times) {
    const index = Math.min(
      count - 1,
      Math.max(0, Math.floor(((time - bounds.start) / span) * count)),
    );
    values[index]!++;
  }
  const peak = Math.max(1, ...values);
  return values.map((value) => value / peak);
}

const position = (time: number, bounds: TimelineBounds) =>
  Math.min(1, Math.max(0, (time - bounds.start) / Math.max(1, bounds.end - bounds.start)));

/** What the scrubber draws under the playhead: where each kind of activity happened. */
export function buildTimeline(lanes: Lanes, bounds: TimelineBounds, count = 160): TimelineTrack[] {
  const tracks: TimelineTrack[] = [
    {
      key: "screen",
      label: "Screen",
      tone: "primary",
      density: buckets(
        lanes.replay.filter((event) => event.type === 3).map((event) => event.timestamp),
        bounds,
        count,
      ),
      marks: [],
    },
    {
      key: "console",
      label: "Console",
      tone: "muted",
      density: buckets(
        lanes.console.map((entry) => entry.t),
        bounds,
        count,
      ),
      marks: lanes.console
        .filter((entry) => entry.level === "error")
        .map((entry) => ({
          at: position(entry.t, bounds),
          tone: "danger" as const,
          label: entry.text,
        })),
    },
    {
      key: "network",
      label: "Network",
      tone: "info",
      density: buckets(
        lanes.network.map((entry) => entry.t),
        bounds,
        count,
      ),
      marks: lanes.network
        .filter((entry) => entry.error !== null || (entry.status ?? 0) >= 400)
        .map((entry) => ({
          at: position(entry.t, bounds),
          tone: "danger" as const,
          label: `${entry.method} ${entry.url} ${entry.status ?? entry.error ?? ""}`,
        })),
    },
    {
      key: "database",
      label: "Database",
      tone: "success",
      density: buckets(
        lanes.database.map((entry) => entry.t),
        bounds,
        count,
      ),
      marks: [],
    },
  ];
  if (lanes.telemetry.length > 0) {
    tracks.push({
      key: "telemetry",
      label: "Telemetry",
      tone: "warning",
      density: buckets(
        lanes.telemetry.map((entry) => entry.t),
        bounds,
        count,
      ),
      marks: lanes.telemetry
        .filter((entry) => entry.kind === "error")
        .map((entry) => ({
          at: position(entry.t, bounds),
          tone: "danger" as const,
          label: entry.name,
        })),
    });
  }
  return tracks;
}

/** Markers drawn on the scrubber itself: what started the recording, routes, pauses, rage taps. */
export function timelineMarkers(
  lanes: Lanes,
  bounds: TimelineBounds,
  rage: ReadonlyArray<{ t: number }> = [],
) {
  return [
    ...lanes.markers.map((marker) => ({
      id: marker.id,
      at: position(marker.t, bounds),
      kind: marker.kind,
      label: marker.label,
    })),
    ...rage.map((tap, index) => ({
      id: `rage:${index}`,
      at: position(tap.t, bounds),
      kind: "rage",
      label: "Rage tap: three or more taps on one spot",
    })),
  ];
}

export function sessionBounds(lanes: Lanes, startedAt: number, endedAt: number): TimelineBounds {
  let start = startedAt;
  let end = endedAt;
  const first = lanes.replay[0]?.timestamp;
  const last = lanes.replay[lanes.replay.length - 1]?.timestamp;
  if (first !== undefined) start = Math.min(start, first);
  if (last !== undefined) end = Math.max(end, last);
  for (const lane of [
    lanes.console,
    lanes.network,
    lanes.database,
    lanes.telemetry,
    lanes.markers,
    lanes.steps,
  ]) {
    const head = lane[0];
    const tail = lane[lane.length - 1];
    if (head) start = Math.min(start, head.t);
    if (tail) end = Math.max(end, tail.t);
  }
  return { start, end: Math.max(end, start + 1000) };
}
