import { useResizeObserver } from "@vueuse/core";
import { onScopeDispose, ref, shallowRef, type Ref } from "vue";
import type { Replayer as ReplayerType } from "@rrweb/replay";
import { dominantSize, insertSize, sizeAt, sizeOf, type SizeAt } from "../lib/viewport-sizes";
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

/** Within this of the screen recording's end, the player is held rather than started again. */
const END_SLACK_MS = 50;

/**
 * Drives the rrweb player inside `root`, scaled to fit `stage`. `time` is milliseconds from the
 * start of the timeline. The timeline is the session's - console, network and database included -
 * and outlasts the screen whenever the UI sits still, so a clock of its own runs it: rrweb follows
 * while the playhead is inside the span it has events for, and holds its first or last frame
 * outside it. rrweb's `finish` only means the screen has nothing more to show.
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
  /** The size the screen held longest, which the page lays itself out for. */
  const shape = shallowRef<{ width: number; height: number } | null>(null);
  const scale = ref(1);
  const replayer = shallowRef<ReplayerType | null>(null);

  let origin = 0;
  let duration = 0;
  let frame = 0;
  let clockAnchor = 0;
  let clockStartedAt = 0;
  let pending: ReplayEvent[] = [];
  /** rrweb is playing on its own timer and the playhead follows it. */
  let following = false;
  /** The offset rrweb was last paused at, so holding a frame does not re-seek every tick. */
  let heldAt: number | null = null;
  /**
   * Every size the app's viewport had, in time order. rrweb does not re-apply a viewport resize when
   * it jumps to a moment, so a phone that started sideways stayed sideways; the player sets the size
   * for the playhead itself.
   */
  const sizes: SizeAt[] = [];

  function noteSizes(events: readonly ReplayEvent[]) {
    let changed = false;
    for (const event of events) {
      const size = sizeOf(event);
      if (!size) continue;
      insertSize(sizes, size);
      changed = true;
    }
    if (changed) reshape();
  }

  function reshape() {
    const next = dominantSize(sizes, origin + duration);
    const current = shape.value;
    if (next && current && next.width === current.width && next.height === current.height) return;
    shape.value = next;
  }

  /** Gives the replay the viewport the app had at the playhead, whatever rrweb last announced. */
  function applySize() {
    const size = sizeAt(sizes, origin + time.value);
    if (!size) return;
    const iframe = replayer.value?.iframe;
    const width = String(size.width);
    const height = String(size.height);
    if (
      iframe &&
      (iframe.getAttribute("width") !== width || iframe.getAttribute("height") !== height)
    ) {
      iframe.setAttribute("width", width);
      iframe.setAttribute("height", height);
    }
    const current = viewport.value;
    if (current && current.width === size.width && current.height === size.height) return;
    viewport.value = { width: size.width, height: size.height };
    fit();
  }

  function fit() {
    const stage = input.stage.value;
    const size = viewport.value;
    if (!stage || !size || size.width <= 0 || size.height <= 0) return;
    const box = stage.getBoundingClientRect();
    scale.value = Math.min(1, (box.width - 32) / size.width, (box.height - 32) / size.height);
  }
  useResizeObserver(input.stage, fit);

  function anchor(at: number) {
    clockAnchor = at;
    clockStartedAt = performance.now();
  }

  /** The timeline span the screen recording has events for, once a player exists. */
  function span(): { start: number; end: number } | null {
    const player = replayer.value;
    if (!player) return null;
    const start = lead();
    return { start, end: start + player.getMetaData().totalTime };
  }

  function hold(offset: number) {
    following = false;
    if (heldAt === offset) return;
    heldAt = offset;
    replayer.value?.pause(offset);
    applySize();
  }

  /** Puts the screen where the playhead is: playing inside its span, held at an edge outside it. */
  function engage() {
    const player = replayer.value;
    const range = span();
    if (!player || !range) return;
    const offset = time.value - range.start;
    const inside = time.value >= range.start && time.value < range.end - END_SLACK_MS;
    if (!inside) {
      hold(Math.max(0, Math.min(range.end - range.start, offset)));
      return;
    }
    if (following) return;
    following = true;
    heldAt = null;
    player.play(offset);
  }

  function tick() {
    frame = 0;
    if (!playing.value) return;
    const player = replayer.value;
    if (following && player) {
      time.value = Math.min(duration, player.getCurrentTime() + lead());
      anchor(time.value);
    } else {
      time.value = Math.min(
        duration,
        clockAnchor + (performance.now() - clockStartedAt) * speed.value,
      );
    }
    if (time.value >= duration) {
      playing.value = false;
      if (following) hold(Math.max(0, time.value - lead()));
      return;
    }
    if (!following) engage();
    applySize();
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
        if (!following) return;
        following = false;
        heldAt = null;
        anchor(time.value);
      });
      player.on("resize", (payload) => {
        if (sizes.length > 0) {
          queueMicrotask(applySize);
          return;
        }
        const { width, height } = payload as { width: number; height: number };
        viewport.value = { width, height };
        fit();
      });
      replayer.value = player;
      noteSizes(events);
      noteSizes(pending);
      for (const event of pending) player.addEvent(event as never);
      pending = [];
      const meta = events.find((event) => event.type === META)?.data as
        | { width?: number; height?: number }
        | undefined;
      if (meta?.width && meta.height) viewport.value = { width: meta.width, height: meta.height };
      fit();
      heldAt = null;
      following = false;
      if (playing.value) engage();
      else hold(replayOffset(time.value));
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
    shape,
    scale,

    /** Sets the timeline the clock runs over: wall-clock start and length in milliseconds. */
    setTimeline(start: number, length: number) {
      const shift = origin === 0 ? 0 : origin - start;
      origin = start;
      duration = length;
      if (sizes.length > 0) reshape();
      if (shift === 0) return;
      time.value = Math.max(0, Math.min(duration, time.value + shift));
      anchor(time.value);
      following = false;
      heldAt = null;
      if (!replayer.value) return;
      if (playing.value) engage();
      else hold(replayOffset(time.value));
    },

    /** Feeds replay events as segments arrive; the player is built once a full snapshot exists. */
    push(events: ReplayEvent[]) {
      const player = replayer.value;
      if (player) {
        noteSizes(events);
        for (const event of events) player.addEvent(event as never);
        if (!playing.value) applySize();
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
      if (time.value >= duration - END_SLACK_MS) time.value = 0;
      playing.value = true;
      anchor(time.value);
      following = false;
      engage();
      startTicking();
    },

    pause() {
      const player = replayer.value;
      if (following && player) time.value = Math.min(duration, player.getCurrentTime() + lead());
      playing.value = false;
      following = false;
      heldAt = null;
      player?.pause();
    },

    seek(to: number) {
      const target = Math.max(0, Math.min(duration, to));
      time.value = target;
      anchor(target);
      following = false;
      heldAt = null;
      if (!replayer.value) return;
      if (playing.value) engage();
      else hold(replayOffset(target));
    },

    setSpeed(value: number) {
      speed.value = value;
      anchor(time.value);
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
      following = false;
      heldAt = null;
      sizes.length = 0;
      shape.value = null;
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
