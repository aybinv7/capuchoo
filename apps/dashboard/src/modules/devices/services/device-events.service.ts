import { http } from "@/shared/api/http";
import { categoryParam } from "../lib/event-filters";
import { normalizeActivityEvent, normalizeDeviceEvent, normalizeEventPage } from "../lib/normalize";
import type {
  ActivityEvent,
  ActivityFilters,
  DeviceEvent,
  EventFilter,
  EventPage,
} from "../types/devices.types";

export const EVENT_PAGE_SIZE = 100;

export const fetchDeviceEvents = async (
  deviceId: string,
  filter: EventFilter,
  before: string | null,
  signal?: AbortSignal,
): Promise<EventPage<DeviceEvent>> =>
  normalizeEventPage(
    await http.get<unknown>(
      `/devices/${encodeURIComponent(deviceId)}/events`,
      { before, limit: EVENT_PAGE_SIZE, category: categoryParam(filter) },
      signal,
    ),
    normalizeDeviceEvent,
  );

export const fetchActivity = async (
  appId: string,
  filters: ActivityFilters,
  before: string | null,
  signal?: AbortSignal,
): Promise<EventPage<ActivityEvent>> =>
  normalizeEventPage(
    await http.get<unknown>(
      `/apps/${encodeURIComponent(appId)}/device-events`,
      {
        before,
        limit: EVENT_PAGE_SIZE,
        category: categoryParam(filters.category),
        channel_id: filters.channelId,
      },
      signal,
    ),
    normalizeActivityEvent,
  );
