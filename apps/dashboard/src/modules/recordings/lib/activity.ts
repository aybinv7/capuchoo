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
  items.push(...databaseActivity(lanes.database));
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

/** Writes this close together read as one burst: a seed, a sync, one screen saving its form. */
const BURST_GAP_MS = 1000;

/**
 * One line per burst of writes rather than per transaction: a sync that writes a hundred rows is one
 * thing that happened. The line opens the burst's first write.
 */
export function databaseActivity(entries: Lanes["database"]): ActivityItem[] {
  const items: ActivityItem[] = [];
  let burst: Lanes["database"] = [];

  const close = () => {
    const first = burst[0];
    if (!first) return;
    const tables = new Set<string>();
    const ops = { insert: 0, update: 0, delete: 0 };
    let rows = 0;
    for (const entry of burst) {
      if (entry.kind === "change") {
        if (entry.table) tables.add(entry.table);
        rows += entry.rows ?? 1;
        continue;
      }
      for (const change of entry.changes) {
        tables.add(change.table);
        ops[change.op] += 1;
        rows += 1;
      }
    }
    const names = [...tables];
    const shown = names.slice(0, 3).join(", ") + (names.length > 3 ? ` +${names.length - 3}` : "");
    const summary = [
      ops.insert ? `+${ops.insert}` : null,
      ops.update ? `~${ops.update}` : null,
      ops.delete ? `−${ops.delete}` : null,
    ]
      .filter(Boolean)
      .join(" ");
    const failed = burst.find((entry) => entry.error);
    items.push({
      id: first.id,
      t: first.t,
      lane: "database",
      tone: failed ? "danger" : "success",
      title: `${rows} ${rows === 1 ? "row" : "rows"} written · ${shown || first.db}`,
      detail: failed?.error ?? (summary || first.db),
    });
    burst = [];
  };

  for (const entry of entries) {
    const last = burst[burst.length - 1];
    if (last && (entry.db !== last.db || entry.t - last.t > BURST_GAP_MS)) close();
    burst.push(entry);
  }
  close();
  return items;
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
