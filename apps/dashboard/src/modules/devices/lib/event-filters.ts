import type { DeviceEventCategory, EventFilter } from "../types/devices.types";

export interface EventFilterOption {
  value: EventFilter;
  label: string;
}

/** The chips over a timeline. Cancelled and unclassified events only show under All. */
export const EVENT_FILTERS: readonly EventFilterOption[] = [
  { value: "all", label: "All" },
  { value: "delivered", label: "Delivered" },
  { value: "failed", label: "Failed" },
  { value: "check", label: "Checks" },
  { value: "downloading", label: "Downloads" },
  { value: "lifecycle", label: "Lifecycle" },
];

const VALUES = new Set<string>(EVENT_FILTERS.map((option) => option.value));

export const isEventFilter = (value: string): value is EventFilter => VALUES.has(value);

/** The `category` query parameter for a filter; empty for All, which the HTTP layer omits. */
export function categoryParam(filter: EventFilter): DeviceEventCategory | "" {
  return filter === "all" ? "" : filter;
}

/** Every category the server classifies events into. */
export const EVENT_CATEGORIES: readonly DeviceEventCategory[] = [
  "check",
  "downloading",
  "delivered",
  "failed",
  "cancelled",
  "lifecycle",
  "other",
];

const CATEGORIES = new Set<DeviceEventCategory>(EVENT_CATEGORIES);

/** A category from the wire; anything a newer server invents reads as `other`. */
export function toCategory(value: unknown): DeviceEventCategory {
  return typeof value === "string" && CATEGORIES.has(value as DeviceEventCategory)
    ? (value as DeviceEventCategory)
    : "other";
}
