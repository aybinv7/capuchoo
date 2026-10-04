import type { NodeChange } from "@vue-flow/core";
import { shallowRef } from "vue";

/** Below this a height change is subpixel noise, and re-laying out on it would never settle. */
const TOLERANCE = 1;

/**
 * The rendered height of every card, from Vue Flow's dimension changes. The layout stacks each
 * column on these, so a card that grew (stats, a step strip, a long error) pushes the next one down
 * instead of overlapping it. Only a real change replaces the map, so the layout recomputes once.
 */
export function useNodeHeights() {
  const heights = shallowRef<ReadonlyMap<string, number>>(new Map());

  function onNodesChange(changes: NodeChange[]) {
    let next: Map<string, number> | null = null;
    for (const change of changes) {
      if (change.type !== "dimensions" || !change.dimensions) continue;
      if (change.id.startsWith("lane:")) continue;
      const height = Math.round(change.dimensions.height);
      const known = (next ?? heights.value).get(change.id);
      if (height <= 0 || (known !== undefined && Math.abs(known - height) <= TOLERANCE)) continue;
      next ??= new Map(heights.value);
      next.set(change.id, height);
    }
    if (next) heights.value = next;
  }

  return { heights, onNodesChange };
}
