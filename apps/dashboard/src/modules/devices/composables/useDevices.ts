import { keepPreviousData, useInfiniteQuery } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { queryKeys } from "@/shared/api/query-keys";
import { DEVICE_PAGE_SIZE, fetchDevices } from "../services/devices.service";
import type { DeviceFilters, LocatedDevice } from "../types/devices.types";

/** Devices matching the filters, fetched by the page as the table scrolls. */
export function useDevices(
  appId: MaybeRefOrGetter<string>,
  filters: MaybeRefOrGetter<DeviceFilters>,
) {
  const query = useInfiniteQuery({
    queryKey: computed(() => queryKeys.devices(toValue(appId), { ...toValue(filters) })),
    queryFn: ({ pageParam, signal }) =>
      fetchDevices(toValue(appId), toValue(filters), pageParam, signal),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.devices.length, 0);
      return last.devices.length === DEVICE_PAGE_SIZE && loaded < last.total ? loaded : undefined;
    },
    enabled: computed(() => Boolean(toValue(appId))),
    placeholderData: keepPreviousData,
  });

  const devices = computed(() => query.data.value?.pages.flatMap((page) => page.devices) ?? []);
  const total = computed(() => query.data.value?.pages[0]?.total ?? 0);
  const located = computed(() =>
    devices.value.filter(
      (device): device is LocatedDevice =>
        typeof device.latitude === "number" && typeof device.longitude === "number",
    ),
  );

  return { ...query, devices, total, located };
}
