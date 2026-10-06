import type { SliceScheduler } from "./slices.js";
import type { SerializedNode, SnapshotMirror } from "./types.js";

/** Slices that run only when a test says so, each with the budget it is given. */
export function manualSlices() {
  const queue: Array<(budgetMs: number) => void> = [];
  const schedule: SliceScheduler = (run) => {
    queue.push(run);
    return () => {
      const index = queue.indexOf(run);
      if (index >= 0) queue.splice(index, 1);
    };
  };
  return {
    schedule,
    get pending() {
      return queue.length;
    },
    runOne(budgetMs = 8): boolean {
      const run = queue.shift();
      run?.(budgetMs);
      return run !== undefined;
    },
    runAll(budgetMs = 8): number {
      let slices = 0;
      while (queue.length > 0) {
        queue.shift()!(budgetMs);
        slices++;
      }
      return slices;
    },
  };
}

/** A clock that moves one millisecond each time it is read: a budget of N is about N nodes. */
export function steppingClock(): () => number {
  let time = 0;
  return () => ++time;
}

export function createTestMirror(): SnapshotMirror & { node(id: number): Node | null } {
  const metas = new Map<Node, SerializedNode>();
  const nodes = new Map<number, Node>();
  return {
    getId: (node) => metas.get(node)?.id ?? -1,
    hasNode: (node) => metas.has(node),
    add(node, meta) {
      metas.set(node, meta);
      nodes.set(meta.id, node);
    },
    node: (id) => nodes.get(id) ?? null,
  };
}

/** Lets pending `MutationObserver` callbacks run. */
export const flushMutations = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
