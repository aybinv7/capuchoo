import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { toValue, type MaybeRefOrGetter } from "vue";
import { isApiError } from "../../api/errors";
import { queryKeys } from "../../api/query-keys";
import {
  pauseChannel,
  pointChannel,
  resumeChannel,
  type PointInput,
} from "../../services/release.service";
import type { Channel, ChannelDetail, ReleaseCatalog } from "../../types/release";

export interface PointVariables {
  channelId: string;
  input: PointInput;
}

export interface PauseVariables {
  channelId: string;
  reason: string | null;
}

/**
 * The three pointer actions. The server's answer replaces the cached channel immediately; history,
 * health and stats refetch because they changed with it. A `stale` refusal means someone else moved
 * the pointer first, so the catalog is refreshed before the person retries.
 */
export function useDeliveryActions(appId: MaybeRefOrGetter<string>) {
  const client = useQueryClient();

  function settle(channel: Channel) {
    client.setQueryData<ReleaseCatalog>(queryKeys.catalog(toValue(appId)), (catalog) =>
      catalog
        ? {
            ...catalog,
            channels: catalog.channels.map((entry) => (entry.id === channel.id ? channel : entry)),
          }
        : catalog,
    );
    client.setQueryData<ChannelDetail>(queryKeys.channel(channel.id), (detail) =>
      detail ? { ...detail, ...channel } : detail,
    );
    void client.invalidateQueries({ queryKey: queryKeys.channel(channel.id) });
    void client.invalidateQueries({
      queryKey: queryKeys.channelInsights(toValue(appId), channel.id),
    });
    void client.invalidateQueries({ queryKey: queryKeys.statsAll(toValue(appId)) });
  }

  function refreshOnConflict(error: unknown) {
    if (isApiError(error) && error.status === 409)
      void client.invalidateQueries({ queryKey: queryKeys.catalog(toValue(appId)) });
  }

  const point = useMutation({
    mutationFn: ({ channelId, input }: PointVariables) => pointChannel(channelId, input),
    onSuccess: settle,
    onError: refreshOnConflict,
  });

  const pause = useMutation({
    mutationFn: ({ channelId, reason }: PauseVariables) => pauseChannel(channelId, reason),
    onSuccess: settle,
    onError: refreshOnConflict,
  });

  const resume = useMutation({
    mutationFn: ({ channelId, reason }: PauseVariables) => resumeChannel(channelId, reason),
    onSuccess: settle,
    onError: refreshOnConflict,
  });

  return { point, pause, resume };
}
