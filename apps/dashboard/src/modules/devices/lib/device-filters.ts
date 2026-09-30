import type { ColumnFiltersState } from "@tanstack/vue-table";
import type { DeviceFilters } from "../types/devices.types";

const ACTIVE_DAYS = new Set<DeviceFilters["activeDays"]>(["", "1", "7", "30"]);

function first(filters: ColumnFiltersState, id: string): string {
  const value = filters.find((filter) => filter.id === id)?.value;
  return Array.isArray(value) && typeof value[0] === "string" ? value[0] : "";
}

/** The table's facet state as the query parameters `GET /apps/:id/devices` accepts. */
export function toDeviceFilters(search: string, filters: ColumnFiltersState): DeviceFilters {
  const days = first(filters, "last_seen") as DeviceFilters["activeDays"];
  return {
    search: search.trim(),
    channelId: first(filters, "channel"),
    activeDays: ACTIVE_DAYS.has(days) ? days : "",
  };
}
