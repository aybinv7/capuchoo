import { placeMarkers } from "@/shared/components/charts/lib/markers";
import type { BarGranularity, ChartMarker } from "@/shared/components/charts/types";
import type { ChannelAction, ChannelHistoryEntry } from "@/shared/types/release";

export type HistoryKind = "deliver" | "rollback" | "clear" | "pause" | "resume";

const KIND: Record<ChannelAction, HistoryKind> = {
  point_bundle: "deliver",
  point_native: "deliver",
  rollback_bundle: "rollback",
  rollback_native: "rollback",
  clear_bundle: "clear",
  clear_native: "clear",
  pause: "pause",
  resume: "resume",
};

const LABEL: Record<ChannelAction, string> = {
  point_bundle: "Delivered bundle",
  point_native: "Delivered native build",
  rollback_bundle: "Rolled back bundle",
  rollback_native: "Rolled back native build",
  clear_bundle: "Cleared bundle",
  clear_native: "Cleared native build",
  pause: "Paused",
  resume: "Resumed",
};

/** Delivery in the primary colour, rollback in amber, everything else muted. */
export const KIND_COLOR: Record<HistoryKind, string> = {
  deliver: "var(--primary)",
  rollback: "var(--warning)",
  clear: "var(--muted-foreground)",
  pause: "var(--muted-foreground)",
  resume: "var(--muted-foreground)",
};

export const historyKind = (action: ChannelAction): HistoryKind => KIND[action] ?? "clear";

export const historyLabel = (action: ChannelAction): string => LABEL[action] ?? action;

/** Who moved the pointer: a person, an API key, or the server itself. */
export const historyActor = (entry: ChannelHistoryEntry): string =>
  entry.actor_email ?? (entry.actor_api_key_id ? "an API key" : "the system");

/** What a chart marker says: `Delivered 1.9.1 by karim@…`. */
export function markerLabel(entry: ChannelHistoryEntry): string {
  const by = `by ${historyActor(entry)}`;
  const version = entry.to_version ?? "nothing";
  switch (historyKind(entry.action)) {
    case "deliver":
      return `Delivered ${version} ${by}`;
    case "rollback":
      return `Rolled back to ${version} ${by}`;
    case "clear":
      return `${historyLabel(entry.action)} ${by}`;
    case "pause":
      return `Paused ${by}`;
    case "resume":
      return `Resumed ${by}`;
  }
}

/** The channel's pointer moves inside a chart's buckets, as markers. */
export function historyMarkers(
  entries: readonly ChannelHistoryEntry[],
  buckets: readonly string[],
  granularity: BarGranularity,
): ChartMarker[] {
  return placeMarkers(
    entries.map((entry) => ({
      key: entry.id,
      at: entry.created_at,
      color: KIND_COLOR[historyKind(entry.action)],
      label: markerLabel(entry),
    })),
    buckets,
    granularity,
  );
}

const BUNDLE_MOVES = new Set<ChannelAction>(["point_bundle", "rollback_bundle"]);

export interface ServingSince {
  at: string;
  by: string;
  rollback: boolean;
  fromVersion: string | null;
}

/** The newest move that put `bundleId` on the channel, from history newest first. */
export function servingSince(
  entries: readonly ChannelHistoryEntry[],
  bundleId: string | null,
): ServingSince | null {
  if (!bundleId) return null;
  const entry = entries.find((row) => BUNDLE_MOVES.has(row.action) && row.to_id === bundleId);
  return entry
    ? {
        at: entry.created_at,
        by: historyActor(entry),
        rollback: entry.action === "rollback_bundle",
        fromVersion: entry.from_version,
      }
    : null;
}

/** Why a paused channel is paused: the reason on its newest pause, if it gave one. */
export function pauseReason(entries: readonly ChannelHistoryEntry[]): string | null {
  const entry = entries.find((row) => row.action === "pause" || row.action === "resume");
  return entry?.action === "pause" ? entry.reason : null;
}

export interface HistoryDay {
  day: string;
  entries: ChannelHistoryEntry[];
}

/** History, newest first, grouped by the day `dayOf` puts each entry in. */
export function groupHistory(
  entries: readonly ChannelHistoryEntry[],
  dayOf: (iso: string) => string,
): HistoryDay[] {
  const days: HistoryDay[] = [];
  for (const entry of entries) {
    const day = dayOf(entry.created_at);
    const last = days[days.length - 1];
    if (last && last.day === day) last.entries.push(entry);
    else days.push({ day, entries: [entry] });
  }
  return days;
}
