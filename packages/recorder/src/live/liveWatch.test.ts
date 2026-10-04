import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createLiveWatch } from "./liveWatch.js";
import type { LiveSocket } from "./types.js";

class FakeSocket implements LiveSocket {
  readyState = 0;
  bufferedAmount = 0;
  sent: Array<Record<string, unknown>> = [];
  closed = false;
  private listeners: Record<string, Array<(event: { data: unknown }) => void>> = {};
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.readyState = 3;
    this.emit("close");
  }
  addEventListener(type: string, listener: (event: { data: unknown }) => void) {
    (this.listeners[type] ??= []).push(listener);
  }
  emit(type: string, data?: unknown) {
    for (const listener of this.listeners[type] ?? []) listener({ data });
  }
  open() {
    this.readyState = 1;
    this.emit("open");
  }
}

let socket: FakeSocket;
let live: boolean;
let snapshots: number;
let listener: ((event: unknown) => void) | null;
let ended: number;
let watch: ReturnType<typeof createLiveWatch>;
const wait = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(() => {
  socket = new FakeSocket();
  live = true;
  snapshots = 0;
  listener = null;
  ended = 0;
  watch = createLiveWatch({
    endpoint: "https://updates.example.com",
    screen: {
      subscribe: (next) => {
        listener = next;
        return () => (listener = null);
      },
      acquire: () => () => undefined,
      snapshot: () => snapshots++,
    },
    isLive: () => live,
    onEnded: () => ended++,
    logger: { warn() {}, error() {} },
    connect: vi.fn(() => socket),
  });
});
afterEach(() => watch.stop());

describe("live watch on the device", () => {
  it("joins the room, starts from a snapshot and streams the screen", async () => {
    watch.join({ room: "r1", ticket: "t1" });
    socket.open();
    expect(socket.sent[0]).toEqual({ t: "hello", room: "r1", role: "device", ticket: "t1" });
    expect(snapshots).toBe(1);
    listener?.({ type: 3, data: { source: 0 } });
    await wait(80);
    expect(socket.sent.at(-1)).toEqual({ t: "events", events: [{ type: 3, data: { source: 0 } }] });
  });

  it("sends another snapshot when a viewer joins later", () => {
    watch.join({ room: "r1", ticket: "t1" });
    socket.open();
    socket.emit("message", JSON.stringify({ t: "snapshot" }));
    expect(snapshots).toBe(2);
  });

  it("streams nothing when the rules have not put the device live", () => {
    live = false;
    watch.join({ room: "r1", ticket: "t1" });
    expect(socket.sent).toEqual([]);
    expect(socket.readyState).toBe(0);
  });

  it("stops when the app leaves the foreground, and asks to hear the room again", () => {
    watch.join({ room: "r1", ticket: "t1" });
    socket.open();
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    expect(socket.closed).toBe(true);
    expect(listener).toBeNull();
    expect(ended).toBe(1);
  });

  it("stops when the device leaves live", () => {
    watch.join({ room: "r1", ticket: "t1" });
    socket.open();
    watch.leave();
    expect(socket.closed).toBe(true);
  });
});
