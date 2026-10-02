import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { queryKeys } from "@/shared/api/query-keys";
import { fetchDeviceEvents } from "../services/device-events.service";
import type { DeviceEvent, EventFilter } from "../types/devices.types";
import { useEventFeed } from "./useEventFeed";

/** One device's timeline, filtered by category, live at its head. */
export function useDeviceEvents(
  appId: MaybeRefOrGetter<string>,
  deviceId: MaybeRefOrGetter<string>,
  filter: MaybeRefOrGetter<EventFilter>,
) {
  return useEventFeed<DeviceEvent>({
    headKey: computed(() =>
      queryKeys.deviceEvents(toValue(appId), toValue(deviceId), toValue(filter)),
    ),
    historyScope: computed(() => ["device", toValue(deviceId), toValue(filter)]),
    fetchPage: (before, signal) =>
      fetchDeviceEvents(toValue(deviceId), toValue(filter), before, signal),
    enabled: computed(() => Boolean(toValue(appId) && toValue(deviceId))),
  });
}
