import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useServedArtefacts } from "../../queries/useChannelQueries";
import type { Channel } from "../../types/release";
import { servedByBaseIds } from "../lib/eligibility";

/**
 * For a client channel, the artefact ids its base release channel has served, which `canPoint`
 * needs. Release channels need nothing, so nothing is fetched for them.
 */
export function useBaseServed(
  channel: MaybeRefOrGetter<Channel | null | undefined>,
  channels: MaybeRefOrGetter<readonly Channel[]>,
) {
  const baseId = computed(() => {
    const value = toValue(channel);
    return value?.kind === "client" ? value.base_channel_id : null;
  });
  const served = useServedArtefacts(baseId);
  const base = computed(() => toValue(channels).find((entry) => entry.id === baseId.value));

  return {
    base,
    served: computed(() =>
      servedByBaseIds(
        base.value,
        (served.data.value ?? []).map((id) => ({ to_id: id })),
      ),
    ),
    pending: computed(() => Boolean(baseId.value) && served.isPending.value),
  };
}
