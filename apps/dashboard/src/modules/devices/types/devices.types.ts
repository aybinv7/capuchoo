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
