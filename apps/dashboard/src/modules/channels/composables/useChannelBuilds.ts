import { useQuery } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { queryKeys } from "@/shared/api/query-keys";
import { fetchChannelBuilds } from "../services/channel-insights.service";

export const CHANNEL_RUNS_LIMIT = 8;

/** The latest runs and deploys that targeted a channel; the live stream keeps their status. */
export function useChannelBuilds(
  appId: MaybeRefOrGetter<string>,
  channelId: MaybeRefOrGetter<string>,
) {
  return useQuery({
    queryKey: computed(() => queryKeys.channelBuilds(toValue(appId), toValue(channelId))),
    queryFn: ({ signal }) =>
      fetchChannelBuilds(toValue(appId), toValue(channelId), CHANNEL_RUNS_LIMIT, signal),
    enabled: computed(() => Boolean(toValue(appId) && toValue(channelId))),
  });
}
