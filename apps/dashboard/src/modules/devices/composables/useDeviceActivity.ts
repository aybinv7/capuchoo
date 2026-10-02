import { toValue, type MaybeRefOrGetter } from "vue";
import { useActivityQuery } from "@/shared/activity/composables/useActivityQuery";
import { queryKeys } from "@/shared/api/query-keys";
import type { ResolvedPeriod } from "@/shared/period/lib/period";
import { fetchDeviceActivity } from "../services/device-activity.service";

/** `GET /api/devices/:id/activity` over a resolved period, in the viewer's zone. */
export function useDeviceActivity(
  appId: MaybeRefOrGetter<string>,
  deviceId: MaybeRefOrGetter<string>,
  period: MaybeRefOrGetter<ResolvedPeriod>,
) {
  return useActivityQuery({
    subject: deviceId,
    period,
    key: (subject, window) => queryKeys.deviceActivity(toValue(appId), subject, window),
    fetch: fetchDeviceActivity,
    enabled: () => Boolean(toValue(appId)),
  });
}
