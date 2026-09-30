import { computed, type WritableComputedRef } from "vue";
import { useRoute, useRouter } from "vue-router";

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
    set: (value) => {
      const query = { ...route.query };
      if (!value || value === fallback) delete query[name];
      else query[name] = value;
      void router.replace({ query });
    },
  });
}
