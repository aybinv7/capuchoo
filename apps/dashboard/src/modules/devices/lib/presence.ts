import type { Tone } from "@/shared/lib/tone";

/** A device that checked in within this window counts as online. */
export const ONLINE_WINDOW_MS = 15 * 60_000;
const RECENT_WINDOW_MS = 24 * 60 * 60_000;

export type Presence = "online" | "recent" | "offline" | "unknown";

/** Online within 15 minutes, recent within a day, offline beyond; unknown without a valid time. */
export function devicePresence(lastSeenAt: string | null | undefined, now: number): Presence {
  if (!lastSeenAt) return "unknown";
  const seen = Date.parse(lastSeenAt);
  if (Number.isNaN(seen)) return "unknown";
  const age = Math.max(0, now - seen);
  if (age <= ONLINE_WINDOW_MS) return "online";
  if (age <= RECENT_WINDOW_MS) return "recent";
  return "offline";
}

export const PRESENCE_TONE: Record<Presence, Tone> = {
  online: "success",
  recent: "info",
  offline: "muted",
  unknown: "muted",
};
