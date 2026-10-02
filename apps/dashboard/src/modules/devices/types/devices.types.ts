import type { DeviceAttributes, Environment, UpdateEventCategory } from "@capuchoo/core";

export type { DeviceAttributes };

/** One row of `GET /api/apps/:id/devices`. */
export interface Device {
  id: string;
  app_id: string;
  device_id: string;
  custom_id: string | null;
  platform: "android" | "ios" | "web";
  is_prod: boolean | null;
  is_emulator: boolean | null;
  version_name: string | null;
  version_builtin: string | null;
  version_code: number | null;
  version_os: string | null;
  plugin_version: string | null;
  reported_channel: string | null;
  channel_id: string | null;
  assigned_channel_id: string | null;
  self_channel_id: string | null;
  device_name: string | null;
  manufacturer: string | null;
  model: string | null;
  mem_used_bytes: number | null;
  latitude: number | null;
  longitude: number | null;
  location_accuracy_m: number | null;
  location_reported_at: string | null;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
  channel_name: string | null;
  attributes: DeviceAttributes | null;
  attributes_updated_at: string | null;
}

export interface DevicePage {
  devices: Device[];
  total: number;
}

export interface DeviceFilters {
  search: string;
  channelId: string;
  activeDays: "" | "1" | "7" | "30";
}

export type LocatedDevice = Device & { latitude: number; longitude: number };

export interface DeviceSummary {
  days: number;
  checks: number;
  delivered: number;
  failed: number;
  last_delivered: { version: string | null; at: string } | null;
  last_failure: { action: string; error: string | null; at: string } | null;
}

/**
 * `GET /api/devices/:id`. `summary` is null while the page shows the row the devices list already
 * held, before the detail itself arrives.
 */
export interface DeviceDetail extends Device {
  /** How many days of events the server keeps; null until the detail itself arrives. */
  retention_days: number | null;
  channel: { id: string; name: string; environment: Environment | null } | null;
  assigned_channel: { id: string; name: string } | null;
  summary: DeviceSummary | null;
}

export type DeviceEventCategory = UpdateEventCategory;

/** One row of `GET /api/devices/:id/events`. */
export interface DeviceEvent {
  id: string;
  kind: "ota" | "native" | "check";
  action: string;
  category: DeviceEventCategory;
  status: string | null;
  version_from: string | null;
  version_to: string | null;
  version_code_to: number | null;
  error: string | null;
  channel_id: string | null;
  created_at: string;
}

/** The fields of a device an app-wide event names. */
export interface DeviceRef {
  id: string;
  custom_id: string | null;
  device_name: string | null;
  model: string | null;
  attributes: DeviceAttributes | null;
}

/** One row of `GET /api/apps/:id/device-events`. */
export interface ActivityEvent extends DeviceEvent {
  device: DeviceRef | null;
}

/** A cursor page: `next` is passed back as `before` for the page after it. */
export interface EventPage<E extends DeviceEvent = DeviceEvent> {
  events: E[];
  next: string | null;
}

export type EventFilter = "all" | "delivered" | "failed" | "check" | "downloading" | "lifecycle";

/** An optional `[from, to)` window over events, as ISO instants. */
export interface EventBounds {
  from: string | null;
  to: string | null;
}

export interface ActivityFilters extends EventBounds {
  category: EventFilter;
  channelId: string;
}
