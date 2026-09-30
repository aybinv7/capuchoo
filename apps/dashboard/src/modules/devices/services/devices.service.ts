import { http } from "@/shared/api/http";
import type { Device, DeviceFilters, DevicePage } from "../types/devices.types";

export const DEVICE_PAGE_SIZE = 200;

export const fetchDevices = (
  appId: string,
  filters: DeviceFilters,
  offset: number,
  signal?: AbortSignal,
) =>
  http.get<DevicePage>(
    `/apps/${appId}/devices`,
    {
      limit: DEVICE_PAGE_SIZE,
      offset,
      search: filters.search.trim(),
      channel_id: filters.channelId,
      active_days: filters.activeDays,
    },
    signal,
  );

export const assignDeviceChannel = (deviceId: string, channelId: string | null) =>
  http.put<Device>(`/devices/${deviceId}/channel`, { channel_id: channelId });

export const removeDevice = (deviceId: string) => http.delete(`/devices/${deviceId}`);
