import type { RecordingMode } from "@capuchoo/core";
import { record } from "@rrweb/record";
import type { Track, TrackContext } from "../recorder/types.js";
import {
  takeSlicedSnapshot,
  type SnapshotJob,
  type SnapshotOutcome,
} from "./snapshot/sliced-snapshot.js";
import { backgroundSlices, type SliceScheduler } from "./snapshot/slices.js";
import type { SerializeSettings, SlimDOMOptions, SnapshotMirror } from "./snapshot/types.js";
import { watchSteps } from "./steps/watch-steps.js";

export interface ReplayOptions {
  /** Masks every input's value. Passwords are masked regardless. Default `false`. */
  maskAllInputs?: boolean;
  /** Text inside matching elements is masked. Default `[data-capuchoo-mask]`. */
  maskTextSelector?: string;
  /**
   * Matching elements are recorded as empty boxes of the same size. Default `[data-capuchoo-block]`.
   * Blocking a long list the user rarely needs to see (a catalogue, a history) also keeps every
   * full snapshot small: its rows are neither serialized nor stored.
   */
  blockSelector?: string;
  /** Input events on matching elements are not recorded. Default `[data-capuchoo-ignore]`. */
  ignoreSelector?: string;
  /**
   * A full snapshot this often, so a trimmed buffer still starts somewhere playable. Taken when the
   * page is next active after the period ends, in short background tasks rather than inside the
   * event that noticed it, and never while the app is in the background. Default 60 s, and in
   * `buffer` mode half the buffer's length (at least 60 s): the buffer then always holds at least
   * that much before a report.
   */
  checkoutEveryNms?: number;
  /** DOM changes per second above which recording pauses for `cooldownMs`. Default 8000. */
  mutationLimit?: number;
  cooldownMs?: number;
  /** Records taps and typed values as steps a test can be generated from. Default `true`. */
  steps?: boolean;
}

/** What tests replace: when snapshot slices run. */
export interface ReplayInternals {
  schedule?: SliceScheduler;
}

const EVENT_FULL_SNAPSHOT = 2;
const EVENT_INCREMENTAL = 3;
const EVENT_META = 4;
const SOURCE_MUTATION = 0;
const SOURCE_SCROLL = 3;
const SOURCE_INPUT = 5;
const SOURCE_MEDIA = 7;

export const CHECKOUT_EVERY_MS = 60_000;

/** The checkout period when the app sets none: longer in buffer mode, where nothing is uploaded. */
export function checkoutIntervalFor(mode: RecordingMode, bufferMaxMs: number): number {
  return mode === "buffer" ? Math.max(CHECKOUT_EVERY_MS, bufferMaxMs / 2) : CHECKOUT_EVERY_MS;
}

const ALL_INPUTS_MASKED: Record<string, boolean> = {
  color: true,
  date: true,
  "datetime-local": true,
  email: true,
  month: true,
  number: true,
  range: true,
  search: true,
  tel: true,
  text: true,
  time: true,
  url: true,
  week: true,
  textarea: true,
  select: true,
  password: true,
};

const SLIM_DOM: SlimDOMOptions = {
  script: true,
  comment: true,
  headFavicon: true,
  headWhitespace: true,
  headMetaDescKeywords: true,
  headMetaSocial: true,
  headMetaRobots: true,
  headMetaHttpEquiv: true,
  headMetaAuthorship: true,
  headMetaVerification: true,
};

/**
 * Ids for nodes rrweb has not seen yet, far above the ones rrweb counts up from 1, so the two never
 * meet in one recording.
 */
let nextNodeId = 2 ** 30;
const allocateId = (): number => nextNodeId++;

interface RecorderEvent {
  type: number;
  data?: unknown;
  timestamp: number;
}

/**
 * rrweb records `play` and `pause` wherever they fire, and Capacitor fires `pause` and `resume` on
 * the document when the app leaves and returns to the foreground. Replayed, that media event lands
 * on the document and throws, so only events on real media elements are kept.
 */
function isStrayMediaEvent(event: RecorderEvent): boolean {
  if (event.type !== EVENT_INCREMENTAL) return false;
  const data = event.data as { source?: number; id?: number } | undefined;
  if (data?.source !== SOURCE_MEDIA || typeof data.id !== "number") return false;
  const node = record.mirror.getNode(data.id);
  return node?.nodeName !== "AUDIO" && node?.nodeName !== "VIDEO";
}

interface MutationData {
  source: number;
  adds?: unknown[];
  removes?: unknown[];
  texts?: unknown[];
  attributes?: unknown[];
}

function mutationWeight(event: RecorderEvent): number {
  if (event.type !== EVENT_INCREMENTAL) return 0;
  const data = event.data as MutationData | undefined;
  if (!data || data.source !== SOURCE_MUTATION) return 0;
  return (
    (data.adds?.length ?? 0) +
    (data.removes?.length ?? 0) +
    (data.texts?.length ?? 0) +
    (data.attributes?.length ?? 0)
  );
}

/** The node an input, scroll or media event says changed, without the DOM changing. */
function touchedNode(event: RecorderEvent): Node | null {
  if (event.type !== EVENT_INCREMENTAL) return null;
  const data = event.data as { source?: number; id?: number } | undefined;
  const source = data?.source;
  if (source !== SOURCE_INPUT && source !== SOURCE_SCROLL && source !== SOURCE_MEDIA) return null;
  return typeof data?.id === "number" ? (record.mirror.getNode(data.id) as Node | null) : null;
}

function isHidden(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

function windowScroll(): { left: number; top: number } {
  const scrolling = document.scrollingElement;
  return {
    left: scrolling ? scrolling.scrollLeft : window.scrollX || 0,
    top: scrolling ? scrolling.scrollTop : window.scrollY || 0,
  };
}

function viewport(): { width: number; height: number } {
  return {
    width: window.innerWidth || document.documentElement?.clientWidth || 0,
    height: window.innerHeight || document.documentElement?.clientHeight || 0,
  };
}

export interface ReplayTrack extends Track {
  /** Starts a full snapshot; the next screen event anyone receives is that snapshot. */
  checkout(): void;
  /** The live node the recording calls `id`, while the screen is being recorded. */
  node(id: number): Node | null;
  /** The checkout period, unless the app set `checkoutEveryNms` itself. */
  setCheckoutInterval(ms: number): void;
}

interface Checkout {
  /** Started for a new session or watcher: screen events are held back until it lands. */
  fresh: boolean;
  job: SnapshotJob | null;
}

/**
 * The DOM, through rrweb, tuned for a phone: stylesheets and images by reference (the server holds
 * them per app version), no mouse moves, scroll and input sampled, and a circuit breaker when the
 * page rewrites thousands of nodes a second.
 *
 * Full snapshots are not rrweb's. rrweb serializes the whole page in one task - about a second for
 * 8,000 nodes on a mid-range phone, frozen under whatever the user was doing - so its periodic
 * checkout is off, its first snapshot is cut down to the root element, and every full snapshot is
 * taken by `takeSlicedSnapshot` in 8 ms background tasks instead. A page rrweb watches outside its
 * snapshot (iframes, shadow roots, adopted stylesheets) still gets rrweb's own.
 */
export function createReplayTrack(
  options: ReplayOptions = {},
  internals: ReplayInternals = {},
): ReplayTrack {
  const limit = options.mutationLimit ?? 8000;
  const cooldownMs = options.cooldownMs ?? 5000;
  const maskAllInputs = options.maskAllInputs ?? false;
  const maskTextSelector = options.maskTextSelector ?? "[data-capuchoo-mask]";
  const blockSelector = options.blockSelector ?? "[data-capuchoo-block]";
  const ignoreSelector = options.ignoreSelector ?? "[data-capuchoo-ignore]";
  const schedule = internals.schedule ?? backgroundSlices();
  const settings: SerializeSettings = {
    maskTextSelector,
    blockSelector,
    maskInputOptions: maskAllInputs ? ALL_INPUTS_MASKED : { password: true },
    slimDOM: SLIM_DOM,
  };
  let deferring = false;
  /**
   * rrweb reads its block selector through `matches` and `closest`, which turn it into a string on
   * every call. While `record()` takes its own first snapshot it reads `:root`, so that snapshot
   * stops at `<html>` and costs nothing; the sliced one replaces it.
   */
  const rrwebBlockSelector = {
    toString: () => (deferring ? ":root" : blockSelector || ":not(*)"),
  } as unknown as string;

  let stopRecording: (() => void) | undefined;
  let stopSteps: (() => void) | undefined;
  let context: TrackContext | null = null;
  let windowStart = 0;
  let windowWeight = 0;
  let resumeTimer: ReturnType<typeof setTimeout> | null = null;
  let interval = options.checkoutEveryNms ?? CHECKOUT_EVERY_MS;
  let lastFullSnapshotAt = 0;
  let current: Checkout | null = null;
  let rrwebOnly = false;

  function forward(event: RecorderEvent): void {
    context?.push("replay", event, event.timestamp);
  }

  function cancelCheckout(): void {
    current?.job?.cancel();
    current = null;
  }

  function takeRrwebSnapshot(): void {
    if (!stopRecording) return;
    try {
      record.takeFullSnapshot(true);
    } catch (error) {
      context?.logger.warn("replay snapshot failed", error);
    }
  }

  function landed(checkout: Checkout, outcome: SnapshotOutcome): void {
    if (current !== checkout) return;
    current = null;
    if (outcome.kind === "done") {
      const at = Date.now();
      const { width, height } = viewport();
      forward({
        type: EVENT_META,
        data: { href: window.location.href, width, height },
        timestamp: at,
      });
      forward({
        type: EVENT_FULL_SNAPSHOT,
        data: { node: outcome.node, initialOffset: windowScroll() },
        timestamp: at,
      });
      lastFullSnapshotAt = at;
      return;
    }
    if (outcome.kind === "failed") context?.logger.warn("sliced snapshot failed", outcome.error);
    else if (outcome.reason !== "iframe") rrwebOnly = true;
    takeRrwebSnapshot();
  }

  function startCheckout(fresh: boolean): void {
    if (!stopRecording) return;
    if (current) {
      current.fresh ||= fresh;
      return;
    }
    if (rrwebOnly) {
      takeRrwebSnapshot();
      return;
    }
    const checkout: Checkout = { fresh, job: null };
    current = checkout;
    checkout.job = takeSlicedSnapshot(
      document,
      { settings, mirror: record.mirror as unknown as SnapshotMirror, allocateId, schedule },
      (outcome) => landed(checkout, outcome),
    );
  }

  function pause(): void {
    cancelCheckout();
    stopRecording?.();
    stopRecording = undefined;
    context?.push("marker", { kind: "replay-paused", reason: "mutation-storm", cooldownMs });
    resumeTimer = setTimeout(() => {
      resumeTimer = null;
      if (context) begin();
    }, cooldownMs);
  }

  function emit(event: RecorderEvent): void {
    if (deferring || isStrayMediaEvent(event)) return;
    const weight = mutationWeight(event);
    if (weight > 0) {
      const at = Date.now();
      if (at - windowStart > 1000) {
        windowStart = at;
        windowWeight = 0;
      }
      windowWeight += weight;
      if (windowWeight > limit) {
        queueMicrotask(pause);
        return;
      }
    }
    if (current) {
      current.job?.touch(touchedNode(event));
      if (current.fresh && event.type === EVENT_INCREMENTAL) return;
    }
    forward(event);
    if (event.type === EVENT_FULL_SNAPSHOT) {
      lastFullSnapshotAt = event.timestamp;
    } else if (
      event.type === EVENT_INCREMENTAL &&
      !current &&
      event.timestamp - lastFullSnapshotAt > interval &&
      !isHidden()
    ) {
      startCheckout(false);
    }
  }

  function begin(): void {
    windowStart = Date.now();
    windowWeight = 0;
    const ready = document.readyState !== "loading";
    deferring = ready;
    try {
      stopRecording =
        record({
          emit: (event) => emit(event as RecorderEvent),
          inlineStylesheet: false,
          inlineImages: false,
          collectFonts: false,
          recordCanvas: false,
          recordCrossOriginIframes: false,
          maskAllInputs,
          maskTextSelector,
          blockSelector: rrwebBlockSelector,
          ignoreSelector,
          sampling: { mousemove: false, scroll: 150, media: 800, input: "last" },
          slimDOMOptions: SLIM_DOM,
          errorHandler: (error) => {
            context?.logger.warn("replay recorder error", error);
            return true;
          },
        }) ?? undefined;
    } finally {
      deferring = false;
    }
    lastFullSnapshotAt = Date.now();
    if (ready) startCheckout(true);
  }

  return {
    name: "replay",
    start(ctx) {
      if (stopRecording || resumeTimer) return;
      context = ctx;
      rrwebOnly = false;
      begin();
      if (options.steps !== false) {
        stopSteps = watchSteps((step) => ctx.push("marker", step), {
          maskAllInputs,
          maskTextSelector,
          ignoreSelector,
        });
      }
    },
    stop() {
      if (resumeTimer !== null) clearTimeout(resumeTimer);
      resumeTimer = null;
      cancelCheckout();
      stopRecording?.();
      stopRecording = undefined;
      stopSteps?.();
      stopSteps = undefined;
      context = null;
    },
    checkout() {
      startCheckout(true);
    },
    node(id) {
      return stopRecording ? (record.mirror.getNode(id) as Node | null) : null;
    },
    setCheckoutInterval(ms) {
      if (options.checkoutEveryNms === undefined) interval = ms;
    },
  };
}
