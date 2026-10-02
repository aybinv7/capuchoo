import { ApiError } from "@/shared/api/errors";
import { http } from "@/shared/api/http";
import { normalizeDeviceDetail, normalizeDeviceRow } from "../lib/normalize";
import type { Device, DeviceDetail, DeviceFilters, DevicePage } from "../types/devices.types";

export const DEVICE_PAGE_SIZE = 200;

export const fetchDevices = async (
  appId: string,
  filters: DeviceFilters,
  offset: number,
  signal?: AbortSignal,
): Promise<DevicePage> => {
  const page = await http.get<DevicePage>(
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
  return {
    devices: Array.isArray(page?.devices) ? page.devices.map(normalizeDeviceRow) : [],
    total: typeof page?.total === "number" ? page.total : 0,
  };
};

export const fetchDevice = async (
  deviceId: string,
  signal?: AbortSignal,
): Promise<DeviceDetail> => {
  const detail = normalizeDeviceDetail(
    await http.get<unknown>(`/devices/${encodeURIComponent(deviceId)}`, undefined, signal),
  );
  if (!detail)
    throw new ApiError(502, "The server sent a device the dashboard cannot read.", "bad_payload");
  return detail;
};

export const assignDeviceChannel = (deviceId: string, channelId: string | null) =>
  http.put<Device>(`/devices/${deviceId}/channel`, { channel_id: channelId });

export const removeDevice = (deviceId: string) => http.delete(`/devices/${deviceId}`);
