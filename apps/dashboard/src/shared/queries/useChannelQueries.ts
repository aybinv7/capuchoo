import { useQuery } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { queryKeys } from "../api/query-keys";
import { fetchChannel, fetchChannelHistory } from "../services/release.service";

export const HISTORY_LIMIT = 200;

/** `GET /api/channels/:id`: the channel with its current artefacts and health. */
export function useChannelDetail(channelId: MaybeRefOrGetter<string | null | undefined>) {
  return useQuery({
    queryKey: computed(() => queryKeys.channel(toValue(channelId) ?? "")),
    queryFn: ({ signal }) => fetchChannel(toValue(channelId) ?? "", signal),
    enabled: computed(() => Boolean(toValue(channelId))),
  });
}

/** Pointer moves, pauses and resumes of a channel, newest first. */
export function useChannelHistory(channelId: MaybeRefOrGetter<string | null | undefined>) {
  return useQuery({
    queryKey: computed(() => queryKeys.channelHistory(toValue(channelId) ?? "")),
    queryFn: ({ signal }) => fetchChannelHistory(toValue(channelId) ?? "", HISTORY_LIMIT, signal),
    enabled: computed(() => Boolean(toValue(channelId))),
  });
}
