import type { AssistAnchor } from "@capuchoo/core";

export interface FrameBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Where a point on the scaled replay lands in the app, in the app's CSS pixels, or null when it is
 * outside the screen. The replay draws the app's viewport at `scale` inside `frame`.
 */
export function toAppPoint(
  clientX: number,
  clientY: number,
  frame: FrameBox,
  viewport: { width: number; height: number },
  scale: number,
): { x: number; y: number } | null {
  if (scale <= 0) return null;
  const x = (clientX - frame.left) / scale;
  const y = (clientY - frame.top) / scale;
  if (x < 0 || y < 0 || x > viewport.width || y > viewport.height) return null;
  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
}

interface AnchorDocument {
  elementFromPoint(x: number, y: number): AnchorElement | null;
  documentElement: unknown;
  body: unknown;
}

interface AnchorElement {
  getBoundingClientRect(): { left: number; top: number; width: number; height: number };
}

const unit = (value: number) => Math.round(Math.max(0, Math.min(1, value)) * 1000) / 1000;

/**
 * The element under a point of the replayed page, as the recording names it, and where in its box
 * the point is. The page and the root elements are skipped: they span the whole screen, so they
 * anchor nothing.
 */
export function anchorAt(
  doc: AnchorDocument,
  idOf: (element: AnchorElement) => number,
  x: number,
  y: number,
): AssistAnchor | null {
  const element = doc.elementFromPoint(x, y);
  if (!element || element === doc.documentElement || element === doc.body) return null;
  const id = idOf(element);
  if (!Number.isInteger(id) || id < 1) return null;
  const box = element.getBoundingClientRect();
  if (box.width <= 0 || box.height <= 0) return null;
  return { id, fx: unit((x - box.left) / box.width), fy: unit((y - box.top) / box.height) };
}

/** A wheel's movement in the app's pixels: a line is about 40 pixels, a page a screen. */
export function wheelDelta(
  event: { deltaX: number; deltaY: number; deltaMode: number },
  viewport: { width: number; height: number },
  scale: number,
): { dx: number; dy: number } {
  const unit =
    event.deltaMode === 1
      ? 40
      : event.deltaMode === 2
        ? viewport.height
        : 1 / Math.max(scale, 0.01);
  return { dx: Math.round(event.deltaX * unit), dy: Math.round(event.deltaY * unit) };
}
