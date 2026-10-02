import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { queryKeys } from "@/shared/api/query-keys";
import { fetchDeviceEvents } from "../services/device-events.service";
import type { DeviceEvent, EventBounds, EventFilter } from "../types/devices.types";
import { useEventFeed } from "./useEventFeed";

/** One device's timeline over a window, filtered by category, live at its head. */
export function useDeviceEvents(
  appId: MaybeRefOrGetter<string>,
  deviceId: MaybeRefOrGetter<string>,
  filter: MaybeRefOrGetter<EventFilter>,
  bounds: MaybeRefOrGetter<EventBounds>,
) {
  const from = computed(() => toValue(bounds).from);
  const to = computed(() => toValue(bounds).to);
  return useEventFeed<DeviceEvent>({
    headKey: computed(() =>
      queryKeys.deviceEvents(
        toValue(appId),
        toValue(deviceId),
        toValue(filter),
        from.value,
        to.value,
      ),
    ),
    historyScope: computed(() => [
      "device",
      toValue(deviceId),
      toValue(filter),
      from.value,
      to.value,
    ]),
    fetchPage: (before, signal) =>
      fetchDeviceEvents(
        toValue(deviceId),
        toValue(filter),
        { from: from.value, to: to.value },
        before,
        signal,
      ),
    enabled: computed(() => Boolean(toValue(appId) && toValue(deviceId))),
  });
}
