import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { queryKeys } from "@/shared/api/query-keys";
import { findListedDevice } from "../lib/listed-device";
import { fetchDevice } from "../services/devices.service";

/**
 * `GET /api/devices/:id`. Until it answers, the row the devices table loaded stands in, so opening
 * a device from the list draws its header without a skeleton.
 */
export function useDeviceDetail(
  appId: MaybeRefOrGetter<string>,
  deviceId: MaybeRefOrGetter<string>,
) {
  const client = useQueryClient();
  return useQuery({
    queryKey: computed(() => queryKeys.deviceDetail(toValue(appId), toValue(deviceId))),
    queryFn: ({ signal }) => fetchDevice(toValue(deviceId), signal),
    enabled: computed(() => Boolean(toValue(appId) && toValue(deviceId))),
    placeholderData: () =>
      findListedDevice(
        client.getQueriesData({ queryKey: queryKeys.devicesAll(toValue(appId)) }),
        toValue(deviceId),
      ),
  });
}
