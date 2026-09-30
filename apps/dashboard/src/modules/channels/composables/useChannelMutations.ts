import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { toValue, type MaybeRefOrGetter } from "vue";
import { queryKeys } from "@/shared/api/query-keys";
import type { Channel, ChannelDetail, ReleaseCatalog } from "@/shared/types/release";
import { createChannel, deleteChannel, updateChannel } from "../services/channels.service";
import type { ChannelPatch, CreateChannelInput } from "../types/channels.types";

/** Channel create, settings and delete, each written straight into the catalog cache. */
export function useChannelMutations(appId: MaybeRefOrGetter<string>) {
  const client = useQueryClient();
  const catalogKey = () => queryKeys.catalog(toValue(appId));

  function upsert(channel: Channel) {
    client.setQueryData<ReleaseCatalog>(catalogKey(), (catalog) => {
      if (!catalog) return catalog;
      const exists = catalog.channels.some((entry) => entry.id === channel.id);
      const channels = exists
        ? catalog.channels.map((entry) => (entry.id === channel.id ? channel : entry))
        : [...catalog.channels, channel];
      return { ...catalog, channels: channels.sort((a, b) => a.name.localeCompare(b.name)) };
    });
    client.setQueryData<ChannelDetail>(queryKeys.channel(channel.id), (detail) =>
      detail ? { ...detail, ...channel } : detail,
    );
  }

  const create = useMutation({
    mutationFn: (input: Omit<CreateChannelInput, "app_id">) =>
      createChannel({ ...input, app_id: toValue(appId) }),
    onSuccess: upsert,
  });

  const update = useMutation({
    mutationFn: ({ channelId, patch }: { channelId: string; patch: ChannelPatch }) =>
      updateChannel(channelId, patch),
    onSuccess: upsert,
  });

  const remove = useMutation({
    mutationFn: (channelId: string) => deleteChannel(channelId, toValue(appId)),
    onSuccess: (_result, channelId) => {
      client.setQueryData<ReleaseCatalog>(catalogKey(), (catalog) =>
        catalog
          ? { ...catalog, channels: catalog.channels.filter((entry) => entry.id !== channelId) }
          : catalog,
      );
      client.removeQueries({ queryKey: queryKeys.channel(channelId) });
      void client.invalidateQueries({ queryKey: queryKeys.statsAll(toValue(appId)) });
    },
  });

  return { create, update, remove };
}
