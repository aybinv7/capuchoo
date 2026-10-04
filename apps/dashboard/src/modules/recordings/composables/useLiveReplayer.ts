import type { AssistAnchor, SafeArea } from "@capuchoo/core";
import { useResizeObserver } from "@vueuse/core";
import { onScopeDispose, ref, shallowRef, type Ref } from "vue";
import type { Replayer as ReplayerType } from "@rrweb/replay";
import { rewriteReplayEvent, type AssetMap } from "../lib/asset-rewrite";
import { anchorAt } from "../lib/assist-coordinates";
import { REPLAY_STYLE_RULES } from "../lib/replay-style";
import { keepReplayEvent } from "../lib/replay-filter";
import { sizeOf } from "../lib/viewport-sizes";
import type { Lanes } from "../types/recordings.types";

type ReplayEvent = Lanes["replay"][number];

const FULL_SNAPSHOT = 2;
const INCREMENTAL = 3;
const MOUSE_INTERACTION = 2;
/** rrweb's MouseDown, Click and TouchStart: where a finger came down. */
const PRESSES = new Set([1, 2, 7]);
/**
 * The live view runs this far behind the first event's time, to absorb the network's unevenness.
 * Events that arrive later than their time are applied at once, so it is the floor, not the delay.
 */
const LIVE_BUFFER_MS = 250;

let loader: Promise<typeof import("@rrweb/replay")> | null = null;
const loadReplay = () => {
  loader ??= Promise.all([import("@rrweb/replay"), import("@rrweb/replay/dist/style.css")]).then(
    ([module]) => module,
  );
  return loader;
};

/**
 * Plays a device's screen as it arrives, in rrweb's live mode, inside `root`, scaled to fit
 * `stage`. The first full snapshot starts it; a later one - the device catching up after a slow
 * patch - rebuilds the page in place.
 */
export function useLiveReplayer(input: {
  root: Ref<HTMLElement | null>;
  stage: Ref<HTMLElement | null>;
  assets: Ref<AssetMap>;
  safeArea: Ref<SafeArea | null>;
}) {
  const viewport = ref<{ width: number; height: number } | null>(null);
  const scale = ref(1);
  const ready = ref(false);
  /** Where the phone's user last touched, and when, for the agent to see their finger. */
  const touch = shallowRef<{ x: number; y: number; at: number } | null>(null);
  const replayer = shallowRef<ReplayerType | null>(null);
  const documents = new Set<number>();
  let pending: ReplayEvent[] = [];
  let creating = false;

  function fit() {
    const stage = input.stage.value;
    const size = viewport.value;
    if (!stage || !size || size.width <= 0 || size.height <= 0) return;
    const box = stage.getBoundingClientRect();
    scale.value = Math.min(1, (box.width - 48) / size.width, (box.height - 48) / size.height);
  }
  useResizeObserver(input.stage, fit);

  function note(event: ReplayEvent) {
    const size = sizeOf(event);
    if (!size || size.width <= 0 || size.height <= 0) return;
    const current = viewport.value;
    if (current?.width === size.width && current.height === size.height) return;
    viewport.value = { width: size.width, height: size.height };
    fit();
  }

  async function create(first: ReplayEvent[]) {
    const root = input.root.value;
    if (!root || creating) return;
    creating = true;
    const { Replayer } = await loadReplay();
    const player = new Replayer([], {
      root,
      liveMode: true,
      showWarning: false,
      mouseTail: false,
      UNSAFE_replayCanvas: false,
      triggerFocus: false,
      insertStyleRules: REPLAY_STYLE_RULES,
    });
    player.startLive((first[0]?.timestamp ?? Date.now()) - LIVE_BUFFER_MS);
    for (const event of [...first, ...pending]) player.addEvent(event as never);
    pending = [];
    replayer.value = player;
    ready.value = true;
    creating = false;
    fit();
  }

  function noteTouch(event: ReplayEvent) {
    if (event.type !== INCREMENTAL) return;
    const data = event.data as { source?: number; type?: number; x?: number; y?: number };
    if (data.source !== MOUSE_INTERACTION || !PRESSES.has(data.type ?? -1)) return;
    if (typeof data.x !== "number" || typeof data.y !== "number") return;
    touch.value = { x: data.x, y: data.y, at: Date.now() };
  }

  return {
    viewport,
    scale,
    ready,
    touch,

    /** The element under a point of the app's screen, so the phone can find the same one. */
    anchorAt(x: number, y: number): AssistAnchor | null {
      const player = replayer.value;
      const doc = player?.iframe.contentDocument;
      if (!player || !doc) return null;
      const mirror = player.getMirror();
      return anchorAt(doc, (element) => mirror.getId(element as never), x, y);
    },

    /** Screen events from the assist socket, in the order the device sent them. */
    push(events: unknown[]) {
      const kept: ReplayEvent[] = [];
      for (const raw of events) {
        const event = raw as ReplayEvent;
        if (typeof event?.type !== "number" || typeof event.timestamp !== "number") continue;
        if (!keepReplayEvent(event, documents)) continue;
        rewriteReplayEvent(event, input.assets.value, input.safeArea.value);
        note(event);
        noteTouch(event);
        kept.push(event);
      }
      const player = replayer.value;
      if (player) {
        for (const event of kept) player.addEvent(event as never);
        return;
      }
      pending.push(...kept);
      const start = pending.findIndex((event) => event.type === FULL_SNAPSHOT);
      if (start < 0) return;
      const first = pending.slice(Math.max(0, start - 1));
      pending = [];
      void create(first);
    },

    destroy() {
      replayer.value?.destroy();
      replayer.value = null;
      ready.value = false;
      pending = [];
    },
  };
}

export function useLiveReplayerDisposal(player: { destroy: () => void }) {
  onScopeDispose(() => player.destroy());
}
