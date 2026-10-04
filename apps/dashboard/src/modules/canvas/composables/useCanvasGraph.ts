import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useAppStats } from "@/shared/queries/useAppStats";
import { useBuilds } from "@/shared/queries/useBuilds";
import { useCatalog } from "@/shared/queries/useCatalog";
import { buildCanvasGraph, type NodePosition } from "../lib/layout";

interface GraphOptions {
  heights?: MaybeRefOrGetter<ReadonlyMap<string, number>>;
  positions?: MaybeRefOrGetter<ReadonlyMap<string, NodePosition>>;
}

/** Real data only: the catalog, per-channel health and the latest builds, laid out as a graph. */
export function useCanvasGraph(appId: MaybeRefOrGetter<string>, options: GraphOptions = {}) {
  const catalogQuery = useCatalog(() => toValue(appId));
  const stats = useAppStats(() => toValue(appId), 7);
  const builds = useBuilds(() => toValue(appId));

  const graph = computed(() =>
    buildCanvasGraph({
      catalog: catalogQuery.catalog.value,
      stats: stats.byChannel.value,
      builds: builds.data.value ?? [],
      heights: toValue(options.heights),
      positions: toValue(options.positions),
    }),
  );

  return {
    graph,
    catalog: catalogQuery.catalog,
    isPending: computed(() => catalogQuery.isPending.value),
    error: computed(
      () => catalogQuery.error.value ?? builds.error.value ?? stats.error.value ?? null,
    ),
    refetch: () => Promise.all([catalogQuery.refetch(), builds.refetch(), stats.refetch()]),
  };
}
