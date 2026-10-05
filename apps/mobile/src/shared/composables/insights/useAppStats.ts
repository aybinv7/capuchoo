import { getStats } from "@/domains/insights/insights.repository";
import { getDatabase, useReactiveQuery } from "@/shared/database";
import { currentAppId } from "@/shared/session/currentApp";
import { syncStats, type StatWindow } from "@/shared/sync/insights";

/** Statistics younger than this are shown as they are; older ones are fetched again. */
const FRESH_MS = 5 * 60_000;

/**
 * The current app's statistics for a window, from SQLite first, so the dashboard opens with the
 * last numbers even offline; the server is asked only when they are missing or stale.
 */
export function useAppStats(days: Ref<StatWindow>) {
  const appId = computed(() => currentAppId.value ?? "");
  const query = useReactiveQuery(() => getStats(getDatabase().db, appId.value, days.value), {
    tables: ["app_stats"],
    queryKey: () => ["stats", appId.value, days.value],
  });

  const fetching = ref(false);
  const error = ref<string | null>(null);

  async function fetch(force = false): Promise<void> {
    const id = appId.value;
    const window = days.value;
    if (!id) return;
    if (!force) {
      const stored = await getStats(getDatabase().db, id, window);
      if (stored && Date.now() - Date.parse(stored.syncedAt) < FRESH_MS) return;
    }
    fetching.value = true;
    try {
      await syncStats(id, window);
      error.value = null;
    } catch (failure) {
      error.value = failure instanceof Error ? failure.message : String(failure);
    } finally {
      fetching.value = false;
    }
  }

  watch([appId, days], () => void fetch(), { immediate: true });

  return {
    stats: computed(() => query.data.value?.stats ?? null),
    syncedAt: computed(() => query.data.value?.syncedAt ?? null),
    loading: query.loading,
    fetching,
    error,
    fetch,
  };
}
