import type { Lanes } from "../types/recordings.types";

const INCREMENTAL = 3;
const MOUSE_INTERACTION = 2;
const CLICK = 2;
const TOUCH_START = 7;

export interface Tap {
  t: number;
  x: number;
  y: number;
}

const RAGE_WINDOW_MS = 800;
const RAGE_RADIUS = 40;
const RAGE_TAPS = 3;
const SAME_TAP_MS = 120;

/** Every tap, from rrweb's touch and click interactions, one per physical tap. */
export function tapsOf(replay: Lanes["replay"]): Tap[] {
  const taps: Tap[] = [];
  for (const event of replay) {
    if (event.type !== INCREMENTAL) continue;
    const data = event.data as { source?: number; type?: number; x?: number; y?: number };
    if (data.source !== MOUSE_INTERACTION) continue;
    if (data.type !== CLICK && data.type !== TOUCH_START) continue;
    if (typeof data.x !== "number" || typeof data.y !== "number") continue;
    const last = taps[taps.length - 1];
    if (
      last &&
      event.timestamp - last.t < SAME_TAP_MS &&
      Math.hypot(last.x - data.x, last.y - data.y) < 12
    ) {
      continue;
    }
    taps.push({ t: event.timestamp, x: data.x, y: data.y });
  }
  return taps;
}

/** Three or more taps in a burst on one spot: the user hammering something that does not answer. */
export function rageTaps(taps: readonly Tap[]): Tap[] {
  const found: Tap[] = [];
  let start = 0;
  for (let end = 0; end < taps.length; end++) {
    while (taps[end]!.t - taps[start]!.t > RAGE_WINDOW_MS) start++;
    const burst = taps.slice(start, end + 1);
    const anchor = taps[end]!;
    const near = burst.filter(
      (tap) => Math.hypot(tap.x - anchor.x, tap.y - anchor.y) < RAGE_RADIUS,
    );
    const previous = found[found.length - 1];
    if (near.length >= RAGE_TAPS && (!previous || anchor.t - previous.t > RAGE_WINDOW_MS)) {
      found.push(anchor);
    }
  }
  return found;
}

/** Taps to draw as ripples: those in the last `windowMs` before the playhead. */
export function recentTaps(taps: readonly Tap[], time: number, windowMs = 650): Tap[] {
  return taps.filter((tap) => tap.t <= time && time - tap.t < windowMs);
}
