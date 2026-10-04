/**
 * Watching a live device: the device streams its screen over one WebSocket and the server fans it
 * out to every viewer, as Assist does but without control and without a prompt - only a device the
 * rules already put live can be watched. Segments still upload; this is the fast path to the eye.
 */

export const LIVE_WATCH_LIMITS = {
  /** A room no viewer is in ends. */
  emptyMs: 5_000,
  /** The longest a room lives; a viewer still watching opens another. */
  roomMs: 2 * 60 * 60_000,
  helloMs: 5_000,
  viewerMessageBytes: 1024,
  deviceMessageBytes: 4 * 1024 * 1024,
  deviceMessagesPerSecond: 60,
} as const;

export type WatchRole = "viewer" | "device";

export interface WatchHello {
  t: "hello";
  room: string;
  role: WatchRole;
  ticket: string;
}

/** What a device's policy answer carries while someone wants to watch it. */
export interface WatchInvite {
  room: string;
  ticket: string;
}

/** What the server tells a device. */
export type WatchToDevice = { t: "snapshot" } | { t: "end"; reason: string };

/** What the server tells a viewer. */
export type WatchToViewer =
  | { t: "ready"; device: boolean }
  | { t: "device"; present: boolean }
  | { t: "end"; reason: string }
  | { t: "error"; code: string; message: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function parseWatchHello(raw: unknown): WatchHello | null {
  if (!isRecord(raw) || raw.t !== "hello") return null;
  if (typeof raw.room !== "string" || typeof raw.ticket !== "string") return null;
  if (raw.role !== "viewer" && raw.role !== "device") return null;
  return { t: "hello", room: raw.room, role: raw.role, ticket: raw.ticket };
}

export function parseWatchInvite(raw: unknown): WatchInvite | null {
  if (!isRecord(raw) || typeof raw.room !== "string" || typeof raw.ticket !== "string") return null;
  return { room: raw.room, ticket: raw.ticket };
}
