import { useResizeObserver } from "@vueuse/core";
import { onScopeDispose, ref, shallowRef, type Ref } from "vue";
import type { Replayer as ReplayerType } from "@rrweb/replay";
import type { Lanes } from "../types/recordings.types";

type ReplayEvent = Lanes["replay"][number];

const FULL_SNAPSHOT = 2;
const META = 4;

export type ReplayerState = "waiting" | "loading" | "ready" | "failed";

let loader: Promise<typeof import("@rrweb/replay")> | null = null;

function loadReplay() {
  loader ??= Promise.all([import("@rrweb/replay"), import("@rrweb/replay/dist/style.css")]).then(
    ([module]) => module,
  );
  return loader;
}

/**
 * Drives the rrweb player inside `root`, scaled to fit `stage`. `time` is milliseconds from the
 * start of the timeline, and keeps moving on a clock of its own when the session has no screen
 * recording, so the lanes still play.
 */
export function useReplayer(input: {
  root: Ref<HTMLElement | null>;
  stage: Ref<HTMLElement | null>;
}) {
  const state = ref<ReplayerState>("waiting");
  const playing = ref(false);
  const time = ref(0);
  const speed = ref(1);
  const skipInactive = ref(true);
  const viewport = ref<{ width: number; height: number } | null>(null);
  const scale = ref(1);
  const replayer = shallowRef<ReplayerType | null>(null);

  let origin = 0;
  let duration = 0;
  let frame = 0;
  let clockAnchor = 0;
  let clockStartedAt = 0;
  let pending: ReplayEvent[] = [];

  function fit() {
    const stage = input.stage.value;
    const size = viewport.value;
    if (!stage || !size) return;
    const box = stage.getBoundingClientRect();
    scale.value = Math.min(1, (box.width - 32) / size.width, (box.height - 32) / size.height);
  }
  useResizeObserver(input.stage, fit);

  function tick() {
    frame = 0;
    if (!playing.value) return;
    const player = replayer.value;
    time.value = player
      ? player.getCurrentTime() + lead()
      : Math.min(duration, clockAnchor + (performance.now() - clockStartedAt) * speed.value);
    if (!player && time.value >= duration) {
      playing.value = false;
      return;
    }
    frame = requestAnimationFrame(tick);
  }

  function startTicking() {
    if (frame === 0) frame = requestAnimationFrame(tick);
  }

  async function create(events: ReplayEvent[]) {
    const root = input.root.value;
    if (!root || replayer.value || state.value === "loading") return;
    state.value = "loading";
    try {
      const { Replayer } = await loadReplay();
      const player = new Replayer(events as never, {
        root,
        skipInactive: skipInactive.value,
        showWarning: false,
        speed: speed.value,
        mouseTail: { duration: 600, lineWidth: 3, strokeStyle: "rgba(201, 100, 66, 0.55)" },
        UNSAFE_replayCanvas: false,
        triggerFocus: false,
        insertStyleRules: ["html, body { scrollbar-width: none; }"],
      });
      player.on("finish", () => {
        playing.value = false;
      });
      player.on("resize", (payload) => {
        const { width, height } = payload as { width: number; height: number };
        viewport.value = { width, height };
        fit();
      });
      replayer.value = player;
      for (const event of pending) player.addEvent(event as never);
      pending = [];
      const meta = events.find((event) => event.type === META)?.data as
        | { width?: number; height?: number }
        | undefined;
      if (meta?.width && meta.height) viewport.value = { width: meta.width, height: meta.height };
      fit();
      player.pause(replayOffset(time.value));
      state.value = "ready";
    } catch {
      state.value = "failed";
    }
  }

  return {
    state,
    playing,
    time,
    speed,
    skipInactive,
    viewport,
    scale,

    /** Sets the timeline the clock runs over: wall-clock start and length in milliseconds. */
    setTimeline(start: number, length: number) {
      origin = start;
      duration = length;
    },

    /** Feeds replay events as segments arrive; the player is built once a full snapshot exists. */
    push(events: ReplayEvent[]) {
      const player = replayer.value;
      if (player) {
        for (const event of events) player.addEvent(event as never);
        return;
      }
      pending.push(...events);
      if (pending.some((event) => event.type === FULL_SNAPSHOT)) {
        const initial = pending;
        pending = [];
        void create(initial);
      }
    },

    play() {
      if (time.value >= duration - 50) time.value = 0;
      playing.value = true;
      clockAnchor = time.value;
      clockStartedAt = performance.now();
      replayer.value?.play(replayOffset(time.value));
      startTicking();
    },

    pause() {
      playing.value = false;
      replayer.value?.pause();
      if (replayer.value) time.value = replayer.value.getCurrentTime() + lead();
    },

    seek(to: number) {
      const target = Math.max(0, Math.min(duration, to));
      time.value = target;
      clockAnchor = target;
      clockStartedAt = performance.now();
      const player = replayer.value;
      if (!player) return;
      if (playing.value) player.play(replayOffset(target));
      else player.pause(replayOffset(target));
    },

    setSpeed(value: number) {
      speed.value = value;
      clockAnchor = time.value;
      clockStartedAt = performance.now();
      replayer.value?.setConfig({ speed: value });
    },

    setSkipInactive(value: boolean) {
      skipInactive.value = value;
      replayer.value?.setConfig({ skipInactive: value });
    },

    /** Wall-clock time of the playhead. */
    wallTime() {
      return origin + time.value;
    },

    destroy() {
      cancelAnimationFrame(frame);
      frame = 0;
      replayer.value?.destroy();
      replayer.value = null;
      pending = [];
      state.value = "waiting";
      playing.value = false;
      time.value = 0;
    },
  };

  /** How far into the timeline the player's first event sits. */
  function lead(): number {
    const first = replayer.value?.getMetaData().startTime;
    return first === undefined ? 0 : Math.max(0, first - origin);
  }

  /** The player counts from its first event; the timeline counts from the session's start. */
  function replayOffset(timelineMs: number): number {
    return Math.max(0, timelineMs - lead());
  }
}

export type ReplayerHandle = ReturnType<typeof useReplayer>;

export function useReplayerDisposal(handle: ReplayerHandle) {
  onScopeDispose(() => handle.destroy());
}
