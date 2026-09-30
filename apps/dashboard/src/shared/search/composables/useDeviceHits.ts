import { keepPreviousData, useQuery } from "@tanstack/vue-query";
import { refDebounced } from "@vueuse/core";
import { MonitorSmartphone } from "@lucide/vue";
import { computed, type Ref } from "vue";
import { queryKeys } from "../../api/query-keys";
import { RouteName } from "../../router/route-names";
import { searchDevices, type DeviceHit } from "../../services/search.service";
import type { SearchItem } from "../types";

const MIN_TERM = 2;

const titleOf = (device: DeviceHit) =>
  device.device_name ||
  [device.manufacturer, device.model].filter(Boolean).join(" ") ||
  device.custom_id ||
  device.device_id;

/**
 * Devices matching the term, asked of the server because the fleet is never loaded whole. The term
 * is debounced and only sent from two characters, so typing does not fire a request per key.
 */
export function useDeviceHits(appId: Ref<string>, term: Ref<string>, enabled: Ref<boolean>) {
  const debounced = refDebounced(term, 250);
  const active = computed(
    () => enabled.value && Boolean(appId.value) && debounced.value.length >= MIN_TERM,
  );

  const query = useQuery({
    queryKey: computed(() =>
      queryKeys.devices(appId.value, { palette: true, search: debounced.value }),
    ),
    queryFn: ({ signal }) => searchDevices(appId.value, debounced.value, signal),
    enabled: active,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const items = computed<SearchItem[]>(() =>
    active.value
      ? (query.data.value?.devices ?? []).map((device) => ({
          id: `device:${device.id}`,
          scope: "devices",
          label: titleOf(device),
          hint: [
            device.platform,
            device.channel_name ?? device.reported_channel,
            device.version_name && `ota ${device.version_name}`,
            device.custom_id ?? device.device_id,
          ]
            .filter(Boolean)
            .join(" · "),
          keywords: [device.device_id, device.custom_id ?? "", term.value],
          icon: MonitorSmartphone,
          to: {
            name: RouteName.devices,
            params: { appId: appId.value },
            query: { q: device.custom_id ?? device.device_id },
          },
        }))
      : [],
  );

  const searching = computed(
    () =>
      enabled.value &&
      term.value.length >= MIN_TERM &&
      (query.isFetching.value || term.value !== debounced.value),
  );

  return { items, searching, error: query.error };
}
