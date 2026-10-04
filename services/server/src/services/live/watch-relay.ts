import { LIVE_WATCH_LIMITS, parseWatchHello, type WatchRole } from "@capuchoo/core";
import type { Logger } from "../../lib/logger";
import { CLOSE, type AssistSocket } from "../assist/socket";
import type { WatchRegistry } from "./watch-registry";

/** Past this queued for the slowest viewer, screen events wait for the next full snapshot. */
const MAX_VIEWER_BACKLOG = 16 * 1024 * 1024;
/**
 * The device's two messages, by how they start: the recorder writes `t` first. Matching the prefix
 * spares parsing a screen of several megabytes only to forward it unchanged.
 */
const EVENTS = '{"t":"events"';
const VIEWPORT = '{"t":"viewport"';

function parse(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Carries one socket of a live room. The device's screen goes to every viewer as it came; a viewer
 * only ever says it is leaving. A refusal is said in a message first, since a proxy may drop the
 * close frame.
 */
export function relayWatchSocket(
  socket: AssistSocket,
  registry: WatchRegistry,
  options: { now: () => number; logger: Logger },
): void {
  let room: string | null = null;
  let role: WatchRole | null = null;
  let windowStart = options.now();
  let inWindow = 0;
  let behind = false;

  const refuse = (code: number, error: string, message: string) => {
    try {
      socket.send(JSON.stringify({ t: "error", code: error, message }));
    } catch {
      return;
    } finally {
      socket.close(code, message);
    }
  };

  const helloTimer = setTimeout(() => {
    if (!room) refuse(CLOSE.noHello, "no_hello", "hello expected");
  }, LIVE_WATCH_LIMITS.helloMs);

  socket.onClose(() => {
    clearTimeout(helloTimer);
    if (room && role) registry.left(room, role, socket);
  });

  socket.onMessage((data, bytes) => {
    if (!room || !role) {
      const hello = bytes <= 1024 ? parseWatchHello(parse(data)) : null;
      if (!hello || !registry.join(hello.room, hello.role, hello.ticket, socket)) {
        options.logger.info("live socket refused", { role: hello?.role ?? null });
        refuse(CLOSE.unauthorized, "unauthorized", "unknown room or ticket");
        return;
      }
      clearTimeout(helloTimer);
      room = hello.room;
      role = hello.role;
      return;
    }

    if (role === "viewer") {
      const message = bytes <= LIVE_WATCH_LIMITS.viewerMessageBytes ? parse(data) : null;
      if ((message as { t?: unknown } | null)?.t === "end") socket.close(CLOSE.normal, "left");
      return;
    }

    if (bytes > LIVE_WATCH_LIMITS.deviceMessageBytes) {
      refuse(CLOSE.tooBig, "too_big", "message too large");
      return;
    }
    const now = options.now();
    if (now - windowStart >= 1000) {
      windowStart = now;
      inWindow = 0;
    }
    if (++inWindow > LIVE_WATCH_LIMITS.deviceMessagesPerSecond) return;
    const events = data.startsWith(EVENTS);
    if (!events && !data.startsWith(VIEWPORT)) return;
    if (events && registry.backlog(room) > MAX_VIEWER_BACKLOG) {
      if (!behind) options.logger.warn("live viewer lagging", { room });
      behind = true;
      return;
    }
    if (behind) {
      behind = false;
      registry.requestSnapshot(room);
      return;
    }
    registry.broadcast(room, data);
  });
}
