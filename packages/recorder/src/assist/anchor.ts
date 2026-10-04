import type { AssistAnchor } from "@capuchoo/core";

/** Where an agent's point lands on this screen, and the element they meant when it is known. */
export interface ResolvedPoint {
  x: number;
  y: number;
  target: Element | null;
}

/**
 * Puts an anchored point on the element the agent saw under it. The dashboard lays the app out
 * with its own fonts, so text wraps differently there and the same coordinates drift by tens of
 * pixels down a long page; the element's box on this screen does not. Without an anchor, or when
 * the element is gone or has no box, the coordinates stand as they were sent.
 */
export function resolvePoint(
  point: { x: number; y: number; anchor?: AssistAnchor },
  nodeOf: ((id: number) => Node | null) | undefined,
): ResolvedPoint {
  const raw = { x: point.x, y: point.y, target: null };
  if (!point.anchor || !nodeOf) return raw;
  const node = nodeOf(point.anchor.id);
  if (!(node instanceof Element) || !node.isConnected) return raw;
  const box = node.getBoundingClientRect();
  if (box.width <= 0 && box.height <= 0) return raw;
  return {
    x: Math.round((box.left + box.width * point.anchor.fx) * 10) / 10,
    y: Math.round((box.top + box.height * point.anchor.fy) * 10) / 10,
    target: node,
  };
}
