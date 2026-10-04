import { measureSafeArea } from "../recorder/safeArea.js";
import type { LiveSocket, ScreenSource } from "./types.js";

/** Screen events are sent in batches this far apart: smooth to watch, few messages. */
const FLUSH_MS = 50;
/** Past this queued on the socket, the other end is too far behind to follow event by event. */
const BEHIND_BYTES = 4 * 1024 * 1024;
/** Below this, it has caught up and gets a fresh full snapshot to continue from. */
const CAUGHT_UP_BYTES = 256 * 1024;
/** A message past this is split; the server refuses anything over 4 MiB. */
const MAX_MESSAGE_CHARS = 3_500_000;
const OPEN = 1;

function chunks(events: unknown[]): string[] {
  const text = JSON.stringify({ t: "events", events });
  if (text.length <= MAX_MESSAGE_CHARS || events.length < 2) return [text];
  const half = Math.ceil(events.length / 2);
  return [...chunks(events.slice(0, half)), ...chunks(events.slice(half))];
}

/**
 * The device's screen over a socket, as it is recorded: from a fresh full snapshot, in 50 ms
 * batches, with the safe-area insets before the first frame and after every rotation. A watcher
 * that falls behind gets nothing until its backlog drains, then a new snapshot - never a queue that
 * grows without end.
 */
export function createScreenStream(socket: LiveSocket, screen: ScreenSource) {
  let queue: unknown[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let catchUp: ReturnType<typeof setInterval> | null = null;
  let behind = false;
  let lastInsets = "";
  let stopScreen: (() => void) | null = null;
  let release: (() => void) | null = null;

  function flush(): void {
    flushTimer = null;
    if (socket.readyState !== OPEN || queue.length === 0) return;
    if (socket.bufferedAmount > BEHIND_BYTES) {
      queue = [];
      if (behind) return;
      behind = true;
      catchUp = setInterval(() => {
        if (socket.bufferedAmount > CAUGHT_UP_BYTES) return;
        if (catchUp) clearInterval(catchUp);
        catchUp = null;
        behind = false;
        screen.snapshot();
      }, 500);
      return;
    }
    const batch = queue;
    queue = [];
    for (const text of chunks(batch)) socket.send(text);
  }

  function enqueue(event: unknown): void {
    if (behind) return;
    queue.push(event);
    flushTimer ??= setTimeout(flush, FLUSH_MS);
  }

  function reportInsets(): void {
    const safeArea = measureSafeArea();
    const key = JSON.stringify(safeArea);
    if (!safeArea || key === lastInsets || socket.readyState !== OPEN) return;
    lastInsets = key;
    socket.send(JSON.stringify({ t: "viewport", safeArea }));
  }

  return {
    start(): void {
      if (stopScreen) return;
      release = screen.acquire();
      stopScreen = screen.subscribe(enqueue);
      reportInsets();
      window.addEventListener("resize", reportInsets);
      screen.snapshot();
    },

    /** A full snapshot now, for a watcher that joined after the first one. */
    snapshot(): void {
      if (stopScreen && !behind) screen.snapshot();
    },

    stop(): void {
      if (flushTimer) clearTimeout(flushTimer);
      if (catchUp) clearInterval(catchUp);
      flushTimer = catchUp = null;
      queue = [];
      window.removeEventListener("resize", reportInsets);
      stopScreen?.();
      release?.();
      stopScreen = release = null;
    },
  };
}

export type ScreenStream = ReturnType<typeof createScreenStream>;
