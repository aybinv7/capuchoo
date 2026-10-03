import { record } from "@rrweb/record";
import type { Track, TrackContext } from "../recorder/types.js";
import { watchSteps } from "./steps/watch-steps.js";

export interface ReplayOptions {
  /** Masks every input's value. Passwords are masked regardless. Default `false`. */
  maskAllInputs?: boolean;
  /** Text inside matching elements is masked. Default `[data-capuchoo-mask]`. */
  maskTextSelector?: string;
  /** Matching elements are recorded as empty boxes of the same size. Default `[data-capuchoo-block]`. */
  blockSelector?: string;
  /** Input events on matching elements are not recorded. Default `[data-capuchoo-ignore]`. */
  ignoreSelector?: string;
  /** A full snapshot this often, so a trimmed buffer still starts somewhere playable. Default 60 s. */
  checkoutEveryNms?: number;
  /** DOM changes per second above which recording pauses for `cooldownMs`. Default 8000. */
  mutationLimit?: number;
  cooldownMs?: number;
  /** Records taps and typed values as steps a test can be generated from. Default `true`. */
  steps?: boolean;
}

const EVENT_INCREMENTAL = 3;
const SOURCE_MEDIA = 7;

/**
 * rrweb records `play` and `pause` wherever they fire, and Capacitor fires `pause` and `resume` on
 * the document when the app leaves and returns to the foreground. Replayed, that media event lands
 * on the document and throws, so only events on real media elements are kept.
 */
function isStrayMediaEvent(event: { type: number; data?: unknown }): boolean {
  if (event.type !== EVENT_INCREMENTAL) return false;
  const data = event.data as { source?: number; id?: number } | undefined;
  if (data?.source !== SOURCE_MEDIA || typeof data.id !== "number") return false;
  const node = record.mirror.getNode(data.id);
  return node?.nodeName !== "AUDIO" && node?.nodeName !== "VIDEO";
}
const SOURCE_MUTATION = 0;

interface MutationData {
  source: number;
  adds?: unknown[];
  removes?: unknown[];
  texts?: unknown[];
  attributes?: unknown[];
}

function mutationWeight(event: { type: number; data?: unknown }): number {
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

export interface ReplayTrack extends Track {
  /** Takes a full snapshot now, so the next session starts with one. */
  checkout(): void;
}

/**
 * The DOM, through rrweb, tuned for a phone: stylesheets and images by reference (the server holds
 * them per app version), no mouse moves, scroll and input sampled, and a circuit breaker when the
 * page rewrites thousands of nodes a second.
 */
export function createReplayTrack(options: ReplayOptions = {}): ReplayTrack {
  const limit = options.mutationLimit ?? 8000;
  const cooldownMs = options.cooldownMs ?? 5000;
  let stopRecording: (() => void) | undefined;
  let stopSteps: (() => void) | undefined;
  let context: TrackContext | null = null;
  let windowStart = 0;
  let windowWeight = 0;
  let resumeTimer: ReturnType<typeof setTimeout> | null = null;

  function pause(): void {
    stopRecording?.();
    stopRecording = undefined;
    context?.push("marker", { kind: "replay-paused", reason: "mutation-storm", cooldownMs });
    resumeTimer = setTimeout(() => {
      resumeTimer = null;
      if (context) begin(context);
    }, cooldownMs);
  }

  function begin(ctx: TrackContext): void {
    windowStart = Date.now();
    windowWeight = 0;
    stopRecording =
      record({
        emit(event) {
          if (isStrayMediaEvent(event as { type: number; data?: unknown })) return;
          const weight = mutationWeight(event as { type: number; data?: unknown });
          if (weight > 0) {
            const now = Date.now();
            if (now - windowStart > 1000) {
              windowStart = now;
              windowWeight = 0;
            }
            windowWeight += weight;
            if (windowWeight > limit) {
              queueMicrotask(pause);
              return;
            }
          }
          ctx.push("replay", event, event.timestamp);
        },
        checkoutEveryNms: options.checkoutEveryNms ?? 60_000,
        inlineStylesheet: false,
        inlineImages: false,
        collectFonts: false,
        recordCanvas: false,
        recordCrossOriginIframes: false,
        maskAllInputs: options.maskAllInputs ?? false,
        maskTextSelector: options.maskTextSelector ?? "[data-capuchoo-mask]",
        blockSelector: options.blockSelector ?? "[data-capuchoo-block]",
        ignoreSelector: options.ignoreSelector ?? "[data-capuchoo-ignore]",
        sampling: { mousemove: false, scroll: 150, media: 800, input: "last" },
        slimDOMOptions: {
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
        },
        errorHandler: (error) => {
          ctx.logger.warn("replay recorder error", error);
          return true;
        },
      }) ?? undefined;
  }

  return {
    name: "replay",
    start(ctx) {
      if (stopRecording || resumeTimer) return;
      context = ctx;
      begin(ctx);
      if (options.steps !== false) {
        stopSteps = watchSteps((step) => ctx.push("marker", step), {
          maskAllInputs: options.maskAllInputs ?? false,
          maskTextSelector: options.maskTextSelector ?? "[data-capuchoo-mask]",
          ignoreSelector: options.ignoreSelector ?? "[data-capuchoo-ignore]",
        });
      }
    },
    stop() {
      if (resumeTimer !== null) clearTimeout(resumeTimer);
      resumeTimer = null;
      stopRecording?.();
      stopRecording = undefined;
      stopSteps?.();
      stopSteps = undefined;
      context = null;
    },
    checkout() {
      if (stopRecording) record.takeFullSnapshot(true);
    },
  };
}
