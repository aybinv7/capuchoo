import type { Lanes } from "../types/recordings.types";

type ReplayEvent = Lanes["replay"][number];

const INCREMENTAL = 3;
const META = 4;
const SOURCE_VIEWPORT_RESIZE = 4;

export interface SizeAt {
  t: number;
  width: number;
  height: number;
}

/** The viewport an event announces: a meta event, or a viewport resize. */
export function sizeOf(event: ReplayEvent): SizeAt | null {
  const data = event.data as { source?: number; width?: number; height?: number } | null;
  const announces =
    event.type === META || (event.type === INCREMENTAL && data?.source === SOURCE_VIEWPORT_RESIZE);
  if (!announces || typeof data?.width !== "number" || typeof data.height !== "number") {
    return null;
  }
  return { t: event.timestamp, width: data.width, height: data.height };
}

/** Adds a size to a time-ordered list, keeping the order. */
export function insertSize(sizes: SizeAt[], size: SizeAt): void {
  let index = sizes.length;
  while (index > 0 && sizes[index - 1]!.t > size.t) index--;
  sizes.splice(index, 0, size);
}

/** The size in force at `wall`; the first one before anything was announced. */
export function sizeAt(sizes: readonly SizeAt[], wall: number): SizeAt | null {
  let found: SizeAt | null = sizes[0] ?? null;
  for (const size of sizes) {
    if (size.t > wall) break;
    found = size;
  }
  return found;
}

/**
 * The size the screen held longest up to `end`. The layout follows it rather than the size at the
 * playhead, so a phone that reports landscape for a moment while it unlocks does not reshape the
 * whole page.
 */
export function dominantSize(
  sizes: readonly SizeAt[],
  end: number,
): { width: number; height: number } | null {
  const held = new Map<string, { width: number; height: number; ms: number }>();
  sizes.forEach((size, index) => {
    if (size.width <= 0 || size.height <= 0) return;
    const until = sizes[index + 1]?.t ?? Math.max(end, size.t + 1);
    const key = `${size.width}x${size.height}`;
    const entry = held.get(key) ?? { width: size.width, height: size.height, ms: 0 };
    entry.ms += Math.max(0, until - size.t);
    held.set(key, entry);
  });
  let best: { width: number; height: number; ms: number } | null = null;
  for (const entry of held.values()) if (!best || entry.ms > best.ms) best = entry;
  return best ? { width: best.width, height: best.height } : null;
}
