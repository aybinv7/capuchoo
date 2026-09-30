import type { QueryClient } from "@tanstack/vue-query";
import type { CacheKey, CacheOp } from "./stream-reducer";

export interface CacheOpApplier {
  apply(ops: readonly CacheOp[]): void;
  dispose(): void;
}

/**
 * Runs reducer output against the query cache. Throttled invalidations collapse into one trailing
 * refetch per key per window, so a fleet reporting at once costs one request, not one per device.
 */
export function createCacheOpApplier(client: QueryClient, windowMs = 4000): CacheOpApplier {
  const pending = new Map<string, { key: CacheKey; timer: ReturnType<typeof setTimeout> }>();

  const flush = (id: string) => {
    const entry = pending.get(id);
    if (!entry) return;
    pending.delete(id);
    void client.invalidateQueries({ queryKey: [...entry.key] });
  };

  return {
    apply(ops) {
      for (const op of ops) {
        if (op.op === "update") {
          client.setQueryData([...op.key], op.update);
          continue;
        }
        if (!op.throttle) {
          void client.invalidateQueries({ queryKey: [...op.key] });
          continue;
        }
        const id = JSON.stringify(op.key);
        if (pending.has(id)) continue;
        pending.set(id, { key: op.key, timer: setTimeout(() => flush(id), windowMs) });
      }
    },
    dispose() {
      for (const entry of pending.values()) clearTimeout(entry.timer);
      pending.clear();
    },
  };
}
