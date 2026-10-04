import type { WatchInvite } from "@capuchoo/core";
import type { RecorderLogger } from "../recorder/types.js";
import { createScreenStream, type ScreenStream } from "./screenStream.js";
import type { LiveSocket, ScreenSource } from "./types.js";

export interface LiveWatchHost {
  endpoint: string;
  screen: ScreenSource;
  /** Whether the rules have the device live; nobody is streamed to otherwise. */
  isLive(): boolean;
  /** The stream ended; the next invite for the same room must be heard again. */
  onEnded(): void;
  logger: RecorderLogger;
  connect?: (url: string) => LiveSocket;
}

interface Active {
  room: string;
  socket: LiveSocket;
  stream: ScreenStream;
}

/**
 * Streams the screen to whoever watches a live device, alongside the segments: the segments keep
 * the recording, the socket gets the screen to the viewer in a fraction of a second. The server only
 * invites a device its rules put live, and the stream stops when the app leaves the foreground.
 */
export function createLiveWatch(host: LiveWatchHost) {
  const connect = host.connect ?? ((url: string) => new WebSocket(url) as LiveSocket);
  let active: Active | null = null;

  function stop(current: Active, close: boolean): void {
    if (active !== current) return;
    active = null;
    current.stream.stop();
    if (close) {
      try {
        current.socket.close(1000, "done");
      } catch {
        host.logger.warn("live socket close failed");
      }
    }
    host.onEnded();
  }

  function onMessage(current: Active, data: unknown): void {
    let message: { t?: unknown };
    try {
      message = JSON.parse(String(data)) as { t?: unknown };
    } catch {
      return;
    }
    if (message.t === "snapshot") current.stream.snapshot();
    else if (message.t === "end" || message.t === "error") stop(current, true);
  }

  function onHidden(): void {
    if (active && document.visibilityState === "hidden") stop(active, true);
  }
  document.addEventListener("visibilitychange", onHidden);

  return {
    /** A room from the policy answer: someone is watching this device. */
    join(invite: WatchInvite): void {
      if (active?.room === invite.room) return;
      if (active) stop(active, true);
      if (!host.isLive() || document.visibilityState === "hidden") return;
      let socket: LiveSocket;
      try {
        socket = connect(`${host.endpoint.replace(/^http/, "ws")}/api/live/ws`);
      } catch (error) {
        host.logger.warn("live connection failed", error);
        host.onEnded();
        return;
      }
      const current: Active = {
        room: invite.room,
        socket,
        stream: createScreenStream(socket, host.screen),
      };
      active = current;
      socket.addEventListener("open", () => {
        socket.send(
          JSON.stringify({ t: "hello", room: invite.room, role: "device", ticket: invite.ticket }),
        );
        current.stream.start();
      });
      socket.addEventListener("message", (event) => onMessage(current, event.data));
      socket.addEventListener("close", () => stop(current, false));
      socket.addEventListener("error", () => host.logger.warn("live socket error"));
    },

    /** The rules took the device off live: nobody may watch it now. */
    leave(): void {
      if (active) stop(active, true);
    },

    stop(): void {
      if (active) stop(active, true);
      document.removeEventListener("visibilitychange", onHidden);
    },
  };
}

export type LiveWatch = ReturnType<typeof createLiveWatch>;
