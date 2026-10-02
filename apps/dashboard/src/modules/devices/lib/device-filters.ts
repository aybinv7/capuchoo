import type { ColumnFiltersState } from "@tanstack/vue-table";
import type { DeviceFilters } from "../types/devices.types";

const ACTIVE_DAYS = new Set<DeviceFilters["activeDays"]>(["", "1", "7", "30"]);

function first(filters: ColumnFiltersState, id: string): string {
  const value = filters.find((filter) => filter.id === id)?.value;
  return Array.isArray(value) && typeof value[0] === "string" ? value[0] : "";
}

/** The table's facet state, plus the URL-only scopes, as `GET /apps/:id/devices` takes them. */
export function toDeviceFilters(
  search: string,
  filters: ColumnFiltersState,
  scope: { version?: string; behind?: boolean } = {},
): DeviceFilters {
  const days = first(filters, "last_seen") as DeviceFilters["activeDays"];
  return {
    search: search.trim(),
    channelId: first(filters, "channel"),
    activeDays: ACTIVE_DAYS.has(days) ? days : "",
    version: scope.version?.trim().slice(0, 64) ?? "",
    behind: scope.behind ?? false,
  };
}

/** The facets with the channel one set to `channelId`, or removed for an empty id. */
export function withChannelFilter(
  filters: ColumnFiltersState,
  channelId: string,
): ColumnFiltersState {
  const others = filters.filter((filter) => filter.id !== "channel");
  return channelId ? [...others, { id: "channel", value: [channelId] }] : others;
}
