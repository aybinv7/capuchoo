import type { TraceMap } from "@jridgewell/trace-mapping";
import { useQueries, useQuery } from "@tanstack/vue-query";
import { computed, markRaw, shallowRef, toValue, watch, type MaybeRefOrGetter } from "vue";
import { queryKeys } from "@/shared/api/query-keys";
import { bundlePath, parseStack, type ResolvedFrame } from "../lib/stack";
import { loadTraceMapping, parseMap, resolveFrames } from "../lib/symbolicate";
import { fetchSourceMap, fetchSourceMapPaths } from "../services/recordings.service";

type TraceMapping = Awaited<ReturnType<typeof loadTraceMapping>>;

export type SymbolicationState = "idle" | "loading" | "missing" | "ready";

/**
 * A recorded stack in the app's own sources, through the maps uploaded for the session's version.
 * Only the maps the stack's frames point at are fetched, each once per dashboard session.
 */
export function useSymbolicatedStack(input: {
  appId: MaybeRefOrGetter<string>;
  version: MaybeRefOrGetter<string>;
  stack: MaybeRefOrGetter<string>;
}) {
  const frames = computed(() => parseStack(toValue(input.stack)));
  const scripts = computed(() => [
    ...new Set(
      frames.value
        .map((frame) => bundlePath(frame.url))
        .filter((path): path is string => path !== null)
        .map((path) => `${path}.map`),
    ),
  ]);
  const wanted = computed(() => scripts.value.length > 0 && Boolean(toValue(input.appId)));

  const listed = useQuery({
    queryKey: computed(() => queryKeys.sourceMaps(toValue(input.appId), toValue(input.version))),
    queryFn: ({ signal }) =>
      fetchSourceMapPaths(toValue(input.appId), toValue(input.version), signal),
    enabled: wanted,
    staleTime: 5 * 60_000,
  });

  const available = computed(() => {
    const uploaded = new Set(listed.data.value ?? []);
    return scripts.value.filter((path) => uploaded.has(path));
  });

  const mapping = shallowRef<TraceMapping | null>(null);
  watch(
    () => available.value.length > 0,
    (needed) => {
      if (needed && !mapping.value)
        void loadTraceMapping().then((loaded) => (mapping.value = loaded));
    },
    { immediate: true },
  );

  const maps = useQueries({
    queries: computed(() =>
      available.value.map((path) => ({
        queryKey: queryKeys.sourceMap(toValue(input.appId), toValue(input.version), path),
        queryFn: async ({ signal }: { signal: AbortSignal }): Promise<TraceMap | null> => {
          const loaded = mapping.value ?? (await loadTraceMapping());
          return markRaw(
            parseMap(
              loaded,
              await fetchSourceMap(toValue(input.appId), toValue(input.version), path, signal),
            ),
          );
        },
        staleTime: Number.POSITIVE_INFINITY,
        gcTime: 30 * 60_000,
        structuralSharing: false,
      })),
    ),
  });

  const resolved = computed<ResolvedFrame[]>(() => {
    const loaded = mapping.value;
    if (!loaded) return frames.value.map((frame) => ({ ...frame, original: null, library: false }));
    const byPath = new Map<string, TraceMap>();
    available.value.forEach((path, index) => {
      const map = maps.value[index]?.data;
      if (map) byPath.set(path, map);
    });
    return resolveFrames(loaded, frames.value, (path) => byPath.get(path) ?? null);
  });

  const state = computed<SymbolicationState>(() => {
    if (!wanted.value) return "idle";
    if (listed.isPending.value) return "loading";
    if (available.value.length === 0) return "missing";
    if (!mapping.value || maps.value.some((query) => query.isPending)) return "loading";
    return "ready";
  });

  return { frames: resolved, state };
}
