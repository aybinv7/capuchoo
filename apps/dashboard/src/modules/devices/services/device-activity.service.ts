import { http } from "@/shared/api/http";
import { normalizeActivity } from "@/shared/activity/lib/normalize-activity";
import type { Activity, ActivityWindow } from "@/shared/activity/types";

export const fetchDeviceActivity = async (
  deviceId: string,
  window: ActivityWindow,
  signal?: AbortSignal,
): Promise<Activity> =>
  normalizeActivity(
    await http.get<unknown>(
      `/devices/${encodeURIComponent(deviceId)}/activity`,
      { from: window.from, to: window.to, bucket: window.bucket, tz: window.tz },
      signal,
    ),
    window,
  );
