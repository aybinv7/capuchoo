import { useQuery } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { viewerZone } from "@/shared/activity/lib/viewer-zone";
import { queryKeys } from "@/shared/api/query-keys";
import { fetchChannelRollout } from "../services/channel-insights.service";

/** `GET /api/channels/:id/rollout`, its curve cut into the viewer's days. */
export function useChannelRollout(
  appId: MaybeRefOrGetter<string>,
  channelId: MaybeRefOrGetter<string>,
) {
  const tz = viewerZone();
  return useQuery({
    queryKey: computed(() => queryKeys.channelRollout(toValue(appId), toValue(channelId), tz)),
    queryFn: ({ signal }) => fetchChannelRollout(toValue(channelId), tz, signal),
    enabled: computed(() => Boolean(toValue(appId) && toValue(channelId))),
  });
}
