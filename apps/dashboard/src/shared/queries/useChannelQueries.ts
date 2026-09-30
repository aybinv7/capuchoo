import { useQuery } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { queryKeys } from "../api/query-keys";
import {
  fetchChannel,
  fetchChannelHistory,
  fetchServedArtefacts,
} from "../services/release.service";

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
/** What a channel has ever served; client channels are judged against their base's list. */
export function useServedArtefacts(channelId: MaybeRefOrGetter<string | null | undefined>) {
  return useQuery({
    queryKey: computed(() => queryKeys.channelServed(toValue(channelId) ?? "")),
    queryFn: ({ signal }) => fetchServedArtefacts(toValue(channelId) ?? "", signal),
    enabled: computed(() => Boolean(toValue(channelId))),
  });
}

export function useChannelHistory(channelId: MaybeRefOrGetter<string | null | undefined>) {
  return useQuery({
    queryKey: computed(() => queryKeys.channelHistory(toValue(channelId) ?? "")),
    queryFn: ({ signal }) => fetchChannelHistory(toValue(channelId) ?? "", HISTORY_LIMIT, signal),
    enabled: computed(() => Boolean(toValue(channelId))),
  });
}
