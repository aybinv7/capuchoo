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
