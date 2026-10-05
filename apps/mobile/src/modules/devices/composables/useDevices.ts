import { listDevices, type Device } from "@/domains/insights/insights.repository";
import { getDatabase, useReactiveQuery } from "@/shared/database";
import { currentAppId } from "@/shared/session/currentApp";
import { syncDevices } from "@/shared/sync/insights";
import { servedChannelId, isActive } from "../lib/deviceLabel";

export type ActivityFilter = "all" | "active" | "idle";

function matchesTerm(device: Device, term: string): boolean {
  return [
    device.device_name,
    device.model,
    device.manufacturer,
    device.device_id,
    device.custom_id,
    device.version_name,
  ].some((field) => field?.toLowerCase().includes(term));
}

/**
 * The current app's devices from SQLite, filtered on the phone: the list is at most a few hundred
 * rows, so a filter costs nothing and works offline.
 */
export function useDevices(initialChannel: string | null = null) {
  const appId = computed(() => currentAppId.value ?? "");
  const query = useReactiveQuery(() => listDevices(getDatabase().db, appId.value), {
    tables: ["device"],
    queryKey: () => ["devices", appId.value],
    debounce: 80,
  });

  const search = ref("");
  const channelId = ref<string | null>(initialChannel);
  const activity = ref<ActivityFilter>("all");

  const all = computed(() => query.data.value ?? []);
  const filtered = computed(() => {
    const term = search.value.trim().toLowerCase();
    const now = Date.now();
    return all.value.filter(
      (device) =>
        (!term || matchesTerm(device, term)) &&
        (!channelId.value || servedChannelId(device) === channelId.value) &&
        (activity.value === "all" || isActive(device, now) === (activity.value === "active")),
    );
  });

  const fetching = ref(false);
  const error = ref<string | null>(null);

  async function refresh(): Promise<void> {
    if (!appId.value) return;
    fetching.value = true;
    try {
      await syncDevices(appId.value);
      error.value = null;
    } catch (failure) {
      error.value = failure instanceof Error ? failure.message : String(failure);
    } finally {
      fetching.value = false;
    }
  }

  return {
    all,
    devices: filtered,
    loading: query.loading,
    search,
    channelId,
    activity,
    fetching,
    error,
    refresh,
  };
}
