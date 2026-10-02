import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { queryKeys } from "@/shared/api/query-keys";
import { fetchActivity } from "../services/device-events.service";
import type { ActivityEvent, ActivityFilters } from "../types/devices.types";
import { useEventFeed } from "./useEventFeed";

/** Every device's events in one feed, filtered by category and channel, live at its head. */
export function useActivityFeed(
  appId: MaybeRefOrGetter<string>,
  filters: MaybeRefOrGetter<ActivityFilters>,
) {
  return useEventFeed<ActivityEvent>({
    headKey: computed(() => queryKeys.activity(toValue(appId), { ...toValue(filters) })),
    historyScope: computed(() => ["activity", toValue(appId), { ...toValue(filters) }]),
    fetchPage: (before, signal) => fetchActivity(toValue(appId), toValue(filters), before, signal),
    enabled: computed(() => Boolean(toValue(appId))),
  });
}
