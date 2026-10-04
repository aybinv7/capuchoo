import { randomUUID } from "node:crypto";
import {
  LIVE_WATCH_LIMITS,
  type WatchInvite,
  type WatchToDevice,
  type WatchToViewer,
} from "@capuchoo/core";
import { CLOSE, type AssistSocket } from "../assist/socket";
import { newTicket, ticketMatches } from "../assist/tickets";

/** A device being watched live, and everyone watching it. */
interface WatchRoom {
  id: string;
  appId: string;
  deviceId: string;
  deviceTicket: Buffer;
  /** In the clear only for the device's own policy answer; the device may rejoin with it. */
  devicePlain: string;
  device: AssistSocket | null;
  viewers: Set<AssistSocket>;
  /** Viewer tickets not used yet: each lets one viewer in once. */
  pending: Buffer[];
  timers: Array<ReturnType<typeof setTimeout>>;
  emptyTimer: ReturnType<typeof setTimeout> | null;
}

const closeQuietly = (socket: AssistSocket | null | undefined, reason: string) => {
  try {
    socket?.close(CLOSE.ended, reason);
  } catch {
    return;
  }
};

const send = (socket: AssistSocket | null | undefined, message: WatchToDevice | WatchToViewer) => {
  try {
    socket?.send(JSON.stringify(message));
  } catch {
    return;
  }
};

/**
 * The live rooms of this process: at most one per device, however many people watch it. The device
 * sends its screen once and every viewer gets it, unparsed. A viewer arriving late asks the device
 * for a full snapshot, so it starts from a whole page rather than from changes to one it never saw.
 */
export class WatchRegistry {
  private readonly rooms = new Map<string, WatchRoom>();
  private readonly byDevice = new Map<string, string>();

  constructor(private readonly hooks: { invite: (appId: string, deviceId: string) => void }) {}

  /** A ticket for one more viewer of a device, opening its room if nobody watches it yet. */
  watch(appId: string, deviceId: string): { room: string; ticket: string } {
    const key = `${appId}:${deviceId}`;
    let room = this.rooms.get(this.byDevice.get(key) ?? "");
    if (!room) {
      const device = newTicket();
      room = {
        id: randomUUID(),
        appId,
        deviceId,
        deviceTicket: device.hash,
        devicePlain: device.plain,
        device: null,
        viewers: new Set(),
        pending: [],
        timers: [],
        emptyTimer: null,
      };
      const opened = room;
      room.timers.push(setTimeout(() => this.end(opened.id, "timeout"), LIVE_WATCH_LIMITS.roomMs));
      this.rooms.set(room.id, room);
      this.byDevice.set(key, room.id);
      this.hooks.invite(appId, deviceId);
    }
    const viewer = newTicket();
    room.pending.push(viewer.hash);
    this.armEmpty(room);
    return { room: room.id, ticket: viewer.plain };
  }

  /** What a device's policy answer carries while its room waits for it. */
  inviteFor(appId: string, deviceId: string): WatchInvite | null {
    const room = this.rooms.get(this.byDevice.get(`${appId}:${deviceId}`) ?? "");
    if (!room || room.device) return null;
    return { room: room.id, ticket: room.devicePlain };
  }

  join(id: string, role: "viewer" | "device", ticket: string, socket: AssistSocket): boolean {
    const room = this.rooms.get(id);
    if (!room) return false;
    if (role === "device") {
      if (!ticketMatches(ticket, room.deviceTicket)) return false;
      if (room.device && room.device !== socket) closeQuietly(room.device, "replaced");
      room.device = socket;
      for (const viewer of room.viewers) send(viewer, { t: "device", present: true });
      return true;
    }
    const index = room.pending.findIndex((hash) => ticketMatches(ticket, hash));
    if (index < 0) return false;
    room.pending.splice(index, 1);
    room.viewers.add(socket);
    if (room.emptyTimer) clearTimeout(room.emptyTimer);
    room.emptyTimer = null;
    send(socket, { t: "ready", device: Boolean(room.device) });
    send(room.device, { t: "snapshot" });
    return true;
  }

  /** The device's screen, as it sent it, to everyone watching; how many got it. */
  broadcast(id: string, data: string): number {
    const room = this.rooms.get(id);
    if (!room) return 0;
    for (const viewer of room.viewers) {
      try {
        viewer.send(data);
      } catch {
        continue;
      }
    }
    return room.viewers.size;
  }

  /** Asks the device for a full snapshot, for viewers that missed what came before. */
  requestSnapshot(id: string): void {
    send(this.rooms.get(id)?.device, { t: "snapshot" });
  }

  /** The slowest viewer's backlog, in bytes. */
  backlog(id: string): number {
    let worst = 0;
    for (const viewer of this.rooms.get(id)?.viewers ?? [])
      worst = Math.max(worst, viewer.buffered);
    return worst;
  }

  left(id: string, role: "viewer" | "device", socket: AssistSocket): void {
    const room = this.rooms.get(id);
    if (!room) return;
    if (role === "device") {
      if (room.device !== socket) return;
      room.device = null;
      for (const viewer of room.viewers) send(viewer, { t: "device", present: false });
      this.hooks.invite(room.appId, room.deviceId);
      return;
    }
    room.viewers.delete(socket);
    this.armEmpty(room);
  }

  /** A room with no viewer for a moment ends; a page reload within it keeps the device streaming. */
  private armEmpty(room: WatchRoom): void {
    if (room.viewers.size > 0 || room.emptyTimer) return;
    room.emptyTimer = setTimeout(() => {
      room.emptyTimer = null;
      if (room.viewers.size === 0) this.end(room.id, "nobody watching");
    }, LIVE_WATCH_LIMITS.emptyMs);
  }

  end(id: string, reason: string): void {
    const room = this.rooms.get(id);
    if (!room) return;
    this.rooms.delete(id);
    const key = `${room.appId}:${room.deviceId}`;
    if (this.byDevice.get(key) === id) this.byDevice.delete(key);
    for (const timer of room.timers) clearTimeout(timer);
    if (room.emptyTimer) clearTimeout(room.emptyTimer);
    for (const socket of [room.device, ...room.viewers]) {
      send(socket, { t: "end", reason });
      closeQuietly(socket, reason);
    }
  }

  closeAll(): void {
    for (const id of [...this.rooms.keys()]) this.end(id, "shutting down");
  }

  get size(): number {
    return this.rooms.size;
  }
}
