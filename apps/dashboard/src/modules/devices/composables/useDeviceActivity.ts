import { keepPreviousData, useQuery } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { queryKeys } from "@/shared/api/query-keys";
import { bucketFor, bucketKeys } from "@/shared/period/lib/buckets";
import type { ResolvedPeriod } from "@/shared/period/lib/period";
import { fetchDeviceActivity } from "../services/device-activity.service";
import type { ActivityWindow, DeviceActivity } from "../types/devices.types";

/** The activity answer with the bucket keys of the window it was asked for, so a chart never mixes ranges. */
export interface DeviceActivityView extends DeviceActivity {
  keys: string[];
}

const viewerZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

/**
 * `GET /api/devices/:id/activity` over a resolved period, hourly up to two days and daily beyond,
 * cut in the viewer's zone. While a new window loads, the previous answer stays on screen.
 */
export function useDeviceActivity(
  appId: MaybeRefOrGetter<string>,
  deviceId: MaybeRefOrGetter<string>,
  period: MaybeRefOrGetter<ResolvedPeriod>,
) {
  const tz = viewerZone();
  const request = computed<ActivityWindow>(() => {
    const resolved = toValue(period);
    return {
      from: resolved.start.toISOString(),
      to: resolved.end.toISOString(),
      bucket: bucketFor(resolved),
      tz,
    };
  });

  return useQuery({
    queryKey: computed(() =>
      queryKeys.deviceActivity(toValue(appId), toValue(deviceId), request.value),
    ),
    queryFn: async ({ queryKey, signal }): Promise<DeviceActivityView> => {
      const asked = queryKey[5] as ActivityWindow;
      const activity = await fetchDeviceActivity(queryKey[3], asked, signal);
      const span = { start: new Date(asked.from), end: new Date(asked.to) };
      return { ...activity, bucket: asked.bucket, keys: bucketKeys(span, asked.bucket) };
    },
    enabled: computed(() => Boolean(toValue(appId) && toValue(deviceId))),
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[3] === toValue(deviceId) ? keepPreviousData(previous) : undefined,
  });
}
