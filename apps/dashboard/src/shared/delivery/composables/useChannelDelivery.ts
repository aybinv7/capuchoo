import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useAppPermissions } from "../../composables/useAppPermissions";
import { ALLOW } from "../../lib/gate";
import { useAppStats } from "../../queries/useAppStats";
import { useCatalog } from "../../queries/useCatalog";
import type { Channel } from "../../types/release";
import { channelCurrent } from "../lib/eligibility";
import { useBaseServed } from "./useBaseServed";

/** Everything a delivery dialog needs about one channel: facts, current pointers, reach and the role gate. */
export function useChannelDelivery(channel: MaybeRefOrGetter<Channel | null | undefined>) {
  const appId = computed(() => toValue(channel)?.app_id ?? "");
  const { catalog, isPending: catalogPending } = useCatalog(appId);
  const { byChannel } = useAppStats(appId);
  const permissions = useAppPermissions();
  const {
    served,
    pending: basePending,
    base,
  } = useBaseServed(
    channel,
    computed(() => catalog.value.channels),
  );

  const current = computed(() => {
    const value = toValue(channel);
    return value ? channelCurrent(value, catalog.value) : { bundle: null, native: null };
  });

  const devices = computed(() => {
    const value = toValue(channel);
    const row = value ? byChannel.value.get(value.id) : undefined;
    return row ? row.devices : null;
  });

  const gate = computed(() => {
    const value = toValue(channel);
    return value ? permissions.deliver(value.environment) : ALLOW;
  });

  return {
    appId,
    catalog,
    current,
    served,
    base,
    devices,
    gate,
    pending: computed(() => catalogPending.value || basePending.value),
  };
}
