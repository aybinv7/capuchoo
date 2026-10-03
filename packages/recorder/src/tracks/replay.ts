import { record } from "@rrweb/record";
import type { Track, TrackContext } from "../recorder/types.js";

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
}

const EVENT_INCREMENTAL = 3;
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
    },
    stop() {
      if (resumeTimer !== null) clearTimeout(resumeTimer);
      resumeTimer = null;
      stopRecording?.();
      stopRecording = undefined;
      context = null;
    },
    checkout() {
      if (stopRecording) record.takeFullSnapshot(true);
    },
  };
}
