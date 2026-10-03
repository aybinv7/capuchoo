import type { Lanes } from "../types/recordings.types";
import type { LaneTone } from "./tones";

export interface ActivityItem {
  id: string;
  t: number;
  lane: "console" | "network" | "database" | "telemetry" | "marker";
  tone: LaneTone;
  title: string;
  detail: string | null;
}

function shortUrl(raw: string): string {
  try {
    const url = new URL(raw);
    return `${url.host}${url.pathname}`;
  } catch {
    return raw;
  }
}

export function networkTone(status: number | null, error: string | null): LaneTone {
  if (error || status === null) return "danger";
  if (status >= 500) return "danger";
  if (status >= 400) return "warning";
  return "info";
}

/**
 * The story of a session in one list: what the user did and what went wrong. Plain logs and
 * performance samples stay in their own tabs; everything here is worth reading on its own.
 */
export function buildActivity(
  lanes: Lanes,
  rage: ReadonlyArray<{ t: number }> = [],
): ActivityItem[] {
  const items: ActivityItem[] = rage.map((tap, index) => ({
    id: `rage:${index}`,
    t: tap.t,
    lane: "marker" as const,
    tone: "danger" as const,
    title: "Rage tap",
    detail: "three or more taps on one spot",
  }));

  for (const marker of lanes.markers) {
    items.push({
      id: marker.id,
      t: marker.t,
      lane: "marker",
      tone: marker.kind === "trigger" || marker.kind === "escalate" ? "primary" : "muted",
      title: marker.label,
      detail: typeof marker.data.note === "string" ? marker.data.note : null,
    });
  }
  for (const entry of lanes.console) {
    if (entry.level !== "error" && entry.level !== "warn") continue;
    items.push({
      id: entry.id,
      t: entry.t,
      lane: "console",
      tone: entry.level === "error" ? "danger" : "warning",
      title: entry.text.split("\n")[0] ?? entry.text,
      detail: entry.source === "console" ? null : entry.source,
    });
  }
  for (const entry of lanes.network) {
    items.push({
      id: entry.id,
      t: entry.t,
      lane: "network",
      tone: networkTone(entry.status, entry.error),
      title: `${entry.method} ${shortUrl(entry.url)}`,
      detail: entry.error ?? `${entry.status ?? "—"} · ${entry.duration} ms`,
    });
  }
  for (const entry of lanes.database) {
    const tables = [...new Set(entry.changes.map((change) => change.table))];
    const title =
      entry.kind === "change"
        ? `${entry.type ?? "write"} ${entry.table ?? ""}`.trim()
        : `${entry.changes.length} ${entry.changes.length === 1 ? "row" : "rows"} in ${tables.join(", ") || "?"}`;
    items.push({
      id: entry.id,
      t: entry.t,
      lane: "database",
      tone: entry.error ? "danger" : "success",
      title,
      detail: entry.error ?? entry.db,
    });
  }
  for (const entry of lanes.telemetry) {
    if (entry.kind === "span-start") continue;
    items.push({
      id: entry.id,
      t: entry.t,
      lane: "telemetry",
      tone: entry.kind === "error" ? "danger" : "muted",
      title: entry.name,
      detail: entry.duration !== null ? `${entry.duration} ms` : entry.kind,
    });
  }

  return items.sort((a, b) => a.t - b.t);
}

/** `m:ss` from the start of the timeline, `h:mm:ss` past an hour. */
export function formatOffset(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`
    : `${minutes}:${seconds}`;
}
