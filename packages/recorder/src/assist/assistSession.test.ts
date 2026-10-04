import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createAssist, type AssistHost } from "./assistSession.js";
import type { AssistSocketLike } from "./types.js";

class FakeSocket implements AssistSocketLike {
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
  receive(message: object) {
    this.emit("message", JSON.stringify(message));
  }
  of(t: string) {
    return this.sent.filter((message) => message.t === t);
  }
}

const original = Element.prototype.attachShadow;
let socket: FakeSocket;
let host: AssistHost;
let screen: { listener: ((event: unknown) => void) | null; snapshots: number; released: number };
let nodes: Map<number, Node>;
let posts: Array<{ url: string; body: unknown }>;
let marks: Array<Record<string, unknown>>;
let assist: ReturnType<typeof createAssist>;

const wait = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
const overlay = () => document.querySelector("capuchoo-assist")?.shadowRoot ?? null;
const button = (label: string) =>
  [...(overlay()?.querySelectorAll("button") ?? [])].find((node) => node.textContent === label);
const invite = (overrides = {}) => ({
  session: "s-1",
  ticket: "device-ticket",
  agent: "Amina",
  expiresAt: Date.now() + 60_000,
  ...overrides,
});

async function joined() {
  void assist.invite(invite());
  await wait();
  button("Allow")!.click();
  await wait();
  socket.open();
  socket.receive({ t: "ready", peer: true, control: "none" });
}

async function granted() {
  socket.receive({ t: "control" });
  await wait();
  button("Allow")!.click();
  await wait();
}

beforeEach(() => {
  Element.prototype.attachShadow = function attachOpen(init: ShadowRootInit) {
    return original.call(this, { ...init, mode: "open" });
  };
  document.body.innerHTML = "";
  socket = new FakeSocket();
  screen = { listener: null, snapshots: 0, released: 0 };
  nodes = new Map();
  posts = [];
  marks = [];
  host = {
    endpoint: "https://updates.example.com",
    screen: {
      subscribe(listener) {
        screen.listener = listener;
        return () => {
          screen.listener = null;
        };
      },
      acquire: () => () => {
        screen.released++;
      },
      snapshot: () => {
        screen.snapshots++;
      },
      nodeOf: (id) => nodes.get(id) ?? null,
    },
    mark: (data) => marks.push(data),
    guards: () => ({
      maskTextSelector: "[data-capuchoo-mask]",
      ignoreSelector: "[data-capuchoo-ignore]",
    }),
    logger: { warn() {}, error() {} },
    connect: vi.fn(() => socket),
    post: async (url, body) => {
      posts.push({ url, body });
    },
  };
  assist = createAssist({}, host);
});

afterEach(() => {
  assist.stop();
  Element.prototype.attachShadow = original;
  vi.restoreAllMocks();
});

describe("assist on the device", () => {
  it("asks the user first, and a no tells the server without opening anything", async () => {
    void assist.invite(invite());
    await wait();
    expect(overlay()?.textContent).toContain("Amina from support wants to see your screen");
    button("Not now")!.click();
    await wait();
    expect(posts).toEqual([
      {
        url: "https://updates.example.com/api/recording/assist/decline",
        body: { session: "s-1", ticket: "device-ticket" },
      },
    ]);
    expect(host.connect).not.toHaveBeenCalled();
    expect(overlay()).toBeNull();
  });

  it("joins with its ticket and streams the screen from a fresh snapshot", async () => {
    await joined();
    expect(host.connect).toHaveBeenCalledWith("wss://updates.example.com/api/assist/ws");
    expect(socket.sent[0]).toEqual({
      t: "hello",
      session: "s-1",
      role: "device",
      ticket: "device-ticket",
    });
    expect(screen.snapshots).toBe(1);
    expect(overlay()?.textContent).toContain("Amina is viewing your screen");

    screen.listener?.({ type: 2, data: {} });
    screen.listener?.({ type: 3, data: { source: 0 } });
    await wait(80);
    expect(socket.of("events")).toEqual([
      {
        t: "events",
        events: [
          { type: 2, data: {} },
          { type: 3, data: { source: 0 } },
        ],
      },
    ]);
    expect(marks).toContainEqual({ kind: "assist", event: "start", agent: "Amina" });
  });

  it("does nothing the agent asks until the user grants control, then taps for them", async () => {
    document.body.innerHTML = `<button id="save">Save</button>`;
    const save = document.getElementById("save")!;
    const clicks = vi.fn();
    save.addEventListener("click", clicks);
    vi.spyOn(document, "elementFromPoint").mockReturnValue(save);
    await joined();

    socket.receive({ t: "tap", x: 10, y: 10 });
    expect(clicks).not.toHaveBeenCalled();
    expect(socket.of("refused")).toHaveLength(1);

    socket.receive({ t: "control" });
    await wait();
    expect(socket.of("control")).toEqual([{ t: "control", state: "asked" }]);
    expect(overlay()?.textContent).toContain("Amina asks to use the app for you");
    button("Allow")!.click();
    await wait();
    expect(socket.of("control").at(-1)).toEqual({ t: "control", state: "granted" });
    expect(overlay()?.textContent).toContain("Amina is using the app");

    socket.receive({ t: "tap", x: 10, y: 10 });
    expect(clicks).toHaveBeenCalledTimes(1);
    expect(clicks.mock.calls[0]![0].isTrusted).not.toBe(true);
  });

  it("lands an anchored tap on the element the agent saw, wherever it sits here", async () => {
    document.body.innerHTML = `<button id="save">Save</button><button id="other">Other</button>`;
    const save = document.getElementById("save")!;
    const other = document.getElementById("other")!;
    const saved = vi.fn();
    const wrong = vi.fn();
    save.addEventListener("click", saved);
    other.addEventListener("click", wrong);
    vi.spyOn(save, "getBoundingClientRect").mockReturnValue(
      DOMRect.fromRect({ x: 100, y: 200, width: 50, height: 20 }),
    );
    vi.spyOn(document, "elementFromPoint").mockImplementation((x, y) =>
      x === 125 && y === 210 ? save : other,
    );
    nodes.set(7, save);
    await joined();
    await granted();

    socket.receive({ t: "tap", x: 125, y: 180, anchor: { id: 7, fx: 0.5, fy: 0.5 } });
    expect(saved).toHaveBeenCalledTimes(1);
    expect(wrong).not.toHaveBeenCalled();

    nodes.clear();
    socket.receive({ t: "tap", x: 125, y: 180, anchor: { id: 7, fx: 0.5, fy: 0.5 } });
    expect(wrong).toHaveBeenCalledTimes(1);
  });

  it("stops the user's own touch while the agent drives, and says so on both ends", async () => {
    await joined();
    await granted();
    const shield = overlay()!.querySelector(".shield")!;

    shield.dispatchEvent(
      new MouseEvent("pointerdown", { clientX: 30, clientY: 40, bubbles: true }),
    );
    shield.dispatchEvent(new MouseEvent("click", { clientX: 30, clientY: 40, bubbles: true }));

    expect(socket.of("blocked")).toEqual([{ t: "blocked", x: 30, y: 40 }]);
    expect(overlay()!.querySelector(".blocked")).not.toBeNull();
    expect(overlay()!.querySelector(".banner")!.classList.contains("nudge")).toBe(true);
    expect(overlay()!.textContent).toContain("Tap Stop to take it back");
  });

  it("taps through the banner to the app beneath it", async () => {
    document.body.innerHTML = `<button id="search">Search</button>`;
    const search = document.getElementById("search")!;
    const searched = vi.fn();
    search.addEventListener("click", searched);
    await joined();
    await granted();
    const layer = overlay()!.querySelector(".layer")!;
    vi.spyOn(document, "elementFromPoint").mockImplementation(() =>
      layer.classList.contains("through")
        ? search
        : (document.querySelector("capuchoo-assist") as Element),
    );

    socket.receive({ t: "tap", x: 200, y: 20 });
    expect(searched).toHaveBeenCalledTimes(1);
    expect(layer.classList.contains("through")).toBe(false);
  });

  it("types into the focused field but never into a password", async () => {
    document.body.innerHTML = `<input id="name"><input id="pin" type="password">`;
    await joined();
    socket.receive({ t: "control" });
    await wait();
    button("Allow")!.click();
    await wait();

    const name = document.getElementById("name") as HTMLInputElement;
    const heard = vi.fn();
    name.addEventListener("input", heard);
    name.focus();
    socket.receive({ t: "type", text: "Benali" });
    expect(name.value).toBe("Benali");
    expect(heard).toHaveBeenCalled();

    const pin = document.getElementById("pin") as HTMLInputElement;
    pin.focus();
    socket.receive({ t: "type", text: "1234" });
    expect(pin.value).toBe("");
    expect(socket.of("refused").at(-1)).toMatchObject({ action: "type" });
  });

  it("ends the moment the user leaves the app, and lets the screen go", async () => {
    await joined();
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    expect(socket.of("end")).toEqual([{ t: "end", reason: "background" }]);
    expect(socket.closed).toBe(true);
    expect(screen.released).toBe(1);
    expect(overlay()).toBeNull();
    expect(marks.at(-1)).toEqual({ kind: "assist", event: "end", reason: "background" });
  });

  it("stops when the user taps Stop", async () => {
    await joined();
    button("Stop")!.click();
    expect(socket.of("end")).toEqual([{ t: "end", reason: "user" }]);
    expect(overlay()).toBeNull();
  });

  it("ignores an invite that has already lapsed", async () => {
    await assist.invite(invite({ expiresAt: Date.now() - 1 }));
    expect(overlay()).toBeNull();
  });
});
