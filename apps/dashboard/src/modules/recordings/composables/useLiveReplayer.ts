import { useResizeObserver } from "@vueuse/core";
import { onScopeDispose, ref, shallowRef, type Ref } from "vue";
import type { Replayer as ReplayerType } from "@rrweb/replay";
import { rewriteReplayEvent, type AssetMap } from "../lib/asset-rewrite";
import { keepReplayEvent } from "../lib/replay-filter";
import { sizeOf } from "../lib/viewport-sizes";
import type { Lanes } from "../types/recordings.types";

type ReplayEvent = Lanes["replay"][number];

const FULL_SNAPSHOT = 2;
/**
 * The live view runs this far behind the device's clock. It absorbs the difference between the
 * phone's clock and this one, and the network's unevenness, at the cost of half a second.
 */
const LIVE_BUFFER_MS = 500;

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
}) {
  const viewport = ref<{ width: number; height: number } | null>(null);
  const scale = ref(1);
  const ready = ref(false);
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
      insertStyleRules: ["html, body { scrollbar-width: none; }"],
    });
    player.startLive((first[0]?.timestamp ?? Date.now()) - LIVE_BUFFER_MS);
    for (const event of [...first, ...pending]) player.addEvent(event as never);
    pending = [];
    replayer.value = player;
    ready.value = true;
    creating = false;
    fit();
  }

  return {
    viewport,
    scale,
    ready,

    /** Screen events from the assist socket, in the order the device sent them. */
    push(events: unknown[]) {
      const kept: ReplayEvent[] = [];
      for (const raw of events) {
        const event = raw as ReplayEvent;
        if (typeof event?.type !== "number" || typeof event.timestamp !== "number") continue;
        if (!keepReplayEvent(event, documents)) continue;
        rewriteReplayEvent(event, input.assets.value);
        note(event);
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
