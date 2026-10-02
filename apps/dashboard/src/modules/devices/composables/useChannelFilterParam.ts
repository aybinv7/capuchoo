import type { ColumnFiltersState } from "@tanstack/vue-table";
import { watch, type Ref } from "vue";
import { useQueryParam } from "@/shared/composables/useQueryParam";
import { toDeviceFilters, withChannelFilter } from "../lib/device-filters";

/**
 * Keeps the table's channel facet and `?channel=` in step, so another page can link to the
 * devices of one channel and a filtered view has a shareable URL.
 */
export function useChannelFilterParam(filters: Ref<ColumnFiltersState>): void {
  const param = useQueryParam<string>("channel", "");
  const channelOf = (state: ColumnFiltersState) => toDeviceFilters("", state).channelId;

  watch(
    param,
    (channelId) => {
      if (channelOf(filters.value) !== channelId)
        filters.value = withChannelFilter(filters.value, channelId);
    },
    { immediate: true },
  );
  watch(
    () => channelOf(filters.value),
    (channelId) => {
      if (param.value !== channelId) param.value = channelId;
    },
  );
}
