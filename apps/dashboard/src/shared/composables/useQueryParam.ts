import { computed, type WritableComputedRef } from "vue";
import { useRoute, useRouter, type Router } from "vue-router";

const pending = new WeakMap<Router, Map<string, string | null>>();

/** Writes made in the same tick land in one navigation, so clearing three filters clears three. */
function write(router: Router, name: string, value: string | null): void {
  let batch = pending.get(router);
  if (!batch) {
    batch = new Map();
    pending.set(router, batch);
    queueMicrotask(() => {
      const changes = pending.get(router);
      pending.delete(router);
      if (!changes) return;
      const query = { ...router.currentRoute.value.query };
      for (const [key, next] of changes) {
        if (next === null) delete query[key];
        else query[key] = next;
      }
      void router.replace({ query });
    });
  }
  batch.set(name, value);
}

/**
 * One query-string parameter as a writable value, so a filtered view has a shareable URL and the
 * command palette can open a page already filtered. Writes replace the history entry.
 */
export function useQueryParam<T extends string = string>(
  name: string,
  fallback: T,
  accept: (value: string) => value is T = (value): value is T => typeof value === "string",
): WritableComputedRef<T> {
  const route = useRoute();
  const router = useRouter();
  return computed<T>({
    get: () => {
      const value = route.query[name];
      return typeof value === "string" && accept(value) ? value : fallback;
    },
    set: (value) => write(router, name, !value || value === fallback ? null : value),
  });
}
