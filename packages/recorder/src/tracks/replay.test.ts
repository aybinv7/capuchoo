import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { TrackContext } from "../recorder/types.js";
import {
  CHECKOUT_EVERY_MS,
  checkoutIntervalFor,
  createReplayTrack,
  type ReplayOptions,
  type ReplayTrack,
} from "./replay.js";
import { manualSlices } from "./snapshot/testing.js";

interface Pushed {
  type: number;
  data: { source?: number; node?: { childNodes: unknown[] } };
}

let pushed: Pushed[];
let track: ReplayTrack | null;
let slices: ReturnType<typeof manualSlices>;
const logger = {
  warn: vi.fn<(message: string, detail?: unknown) => void>(),
  error: vi.fn<(message: string, detail?: unknown) => void>(),
};

const context: TrackContext = {
  push(kind, data) {
    if (kind === "replay") pushed.push(data as Pushed);
  },
  logger,
};

const types = () => pushed.map((event) => event.type);
const tap = (element: Element) => element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
const later = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function startTrack(options: ReplayOptions = {}): ReplayTrack {
  slices = manualSlices();
  track = createReplayTrack({ steps: false, ...options }, { schedule: slices.schedule });
  void track.start(context);
  return track;
}

function htmlChildren(event: Pushed): unknown[] {
  const html = event.data.node?.childNodes.find(
    (node) => (node as { tagName?: string }).tagName === "html",
  ) as { childNodes: unknown[] } | undefined;
  return html?.childNodes ?? [];
}

beforeAll(() => {
  Object.defineProperty(window, "DOMTokenList", {
    value: document.body.classList.constructor,
    configurable: true,
  });
});

beforeEach(() => {
  pushed = [];
  track = null;
  document.body.innerHTML = `<div class="page"><button id="save">Save</button><ul><li>One</li><li>Two</li></ul></div>`;
});

afterEach(() => {
  track?.stop();
  vi.restoreAllMocks();
});

describe("replay track", () => {
  it("starts from a sliced full snapshot of the page, not rrweb's own", () => {
    startTrack();
    expect(types()).toEqual([]);
    expect(slices.pending).toBe(1);
    slices.runAll();
    expect(types()).toEqual([4, 2]);
    expect(htmlChildren(pushed[1]!).length).toBeGreaterThan(0);
  });

  it("takes the periodic checkout in a later task, never inside the tap that noticed it", async () => {
    startTrack({ checkoutEveryNms: 1 });
    slices.runAll();
    pushed = [];
    await later(5);

    tap(document.getElementById("save")!);
    expect(types()).toEqual([3]);
    expect(slices.pending).toBe(1);

    slices.runAll();
    expect(types()).toEqual([3, 4, 2]);
  });

  it("checks out no sooner than the period", async () => {
    startTrack({ checkoutEveryNms: 60_000 });
    slices.runAll();
    tap(document.getElementById("save")!);
    expect(slices.pending).toBe(0);
  });

  it("starts no checkout while the app is in the background", async () => {
    startTrack({ checkoutEveryNms: 1 });
    slices.runAll();
    await later(5);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    tap(document.getElementById("save")!);
    expect(slices.pending).toBe(0);
  });

  it("holds screen events back after an explicit checkout until its snapshot lands", () => {
    startTrack();
    slices.runAll();
    pushed = [];

    track!.checkout();
    tap(document.getElementById("save")!);
    expect(types()).toEqual([]);

    slices.runAll();
    tap(document.getElementById("save")!);
    expect(types()).toEqual([4, 2, 3]);
  });

  it("holds the page's taps back until the first snapshot lands", () => {
    startTrack();
    tap(document.getElementById("save")!);
    expect(types()).toEqual([]);
    slices.runAll();
    expect(types()).toEqual([4, 2]);
  });

  it("falls back to rrweb's own snapshot for a page with a shadow root", () => {
    document.getElementById("save")!.attachShadow({ mode: "open" });
    startTrack();
    slices.runAll();
    expect(types()).toContain(2);
    const full = pushed.find((event) => event.type === 2)!;
    expect(htmlChildren(full).length).toBeGreaterThan(0);

    pushed = [];
    track!.checkout();
    expect(slices.pending).toBe(0);
    expect(types()).toContain(2);
  });

  it("forgets a checkout in flight when stopped", () => {
    startTrack();
    track!.stop();
    track = null;
    slices.runAll();
    expect(types()).toEqual([]);
  });
});

describe("checkoutIntervalFor", () => {
  it("is a minute while uploading, half the buffer (at least a minute) while buffering", () => {
    expect(checkoutIntervalFor("session", 300_000)).toBe(CHECKOUT_EVERY_MS);
    expect(checkoutIntervalFor("live", 300_000)).toBe(CHECKOUT_EVERY_MS);
    expect(checkoutIntervalFor("buffer", 300_000)).toBe(150_000);
    expect(checkoutIntervalFor("buffer", 30_000)).toBe(CHECKOUT_EVERY_MS);
  });

  it("never overrides a period the app chose", async () => {
    startTrack({ checkoutEveryNms: 1 });
    slices.runAll();
    track!.setCheckoutInterval(600_000);
    await later(5);
    tap(document.getElementById("save")!);
    expect(slices.pending).toBe(1);
  });
});
