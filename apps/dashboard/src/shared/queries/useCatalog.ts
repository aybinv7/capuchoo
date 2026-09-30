import { useQuery } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { queryKeys } from "../api/query-keys";
import { fetchCatalog } from "../services/release.service";
import type { ReleaseCatalog } from "../types/release";

const EMPTY: ReleaseCatalog = Object.freeze({ bundles: [], natives: [], channels: [] });

/** Channels, bundles and native builds of an app: the facts every delivery decision needs. */
export function useCatalog(appId: MaybeRefOrGetter<string>) {
  const query = useQuery({
    queryKey: computed(() => queryKeys.catalog(toValue(appId))),
    queryFn: ({ signal }) => fetchCatalog(toValue(appId), signal),
    enabled: computed(() => Boolean(toValue(appId))),
  });
  const catalog = computed(() => query.data.value ?? EMPTY);
  return {
    ...query,
    catalog,
    channels: computed(() => catalog.value.channels),
    bundles: computed(() => catalog.value.bundles),
    natives: computed(() => catalog.value.natives),
  };
}
