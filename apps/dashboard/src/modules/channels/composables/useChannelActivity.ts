import { toValue, type MaybeRefOrGetter } from "vue";
import { useActivityQuery } from "@/shared/activity/composables/useActivityQuery";
import { queryKeys } from "@/shared/api/query-keys";
import type { ResolvedPeriod } from "@/shared/period/lib/period";
import { fetchChannelActivity } from "../services/channel-insights.service";

/** `GET /api/channels/:id/activity` over a resolved period, in the viewer's zone. */
export function useChannelActivity(
  appId: MaybeRefOrGetter<string>,
  channelId: MaybeRefOrGetter<string>,
  period: MaybeRefOrGetter<ResolvedPeriod>,
) {
  return useActivityQuery({
    subject: channelId,
    period,
    key: (subject, window) => queryKeys.channelActivity(toValue(appId), subject, window),
    fetch: fetchChannelActivity,
    enabled: () => Boolean(toValue(appId)),
  });
}
