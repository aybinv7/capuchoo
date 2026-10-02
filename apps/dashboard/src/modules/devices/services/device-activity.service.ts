import { http } from "@/shared/api/http";
import { normalizeDeviceActivity } from "../lib/normalize";
import type { ActivityWindow, DeviceActivity } from "../types/devices.types";

export const fetchDeviceActivity = async (
  deviceId: string,
  window: ActivityWindow,
  signal?: AbortSignal,
): Promise<DeviceActivity> =>
  normalizeDeviceActivity(
    await http.get<unknown>(
      `/devices/${encodeURIComponent(deviceId)}/activity`,
      { from: window.from, to: window.to, bucket: window.bucket, tz: window.tz },
      signal,
    ),
    window,
  );
