import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { toValue, type MaybeRefOrGetter } from "vue";
import { queryKeys } from "@/shared/api/query-keys";
import { assignDeviceChannel, removeDevice } from "../services/devices.service";

/** Assignment and removal; both change what every device page shows, so the pages refetch. */
export function useDeviceMutations(appId: MaybeRefOrGetter<string>) {
  const client = useQueryClient();
  const refresh = () => {
    void client.invalidateQueries({ queryKey: queryKeys.devicesAll(toValue(appId)) });
    void client.invalidateQueries({ queryKey: queryKeys.statsAll(toValue(appId)) });
  };

  const assign = useMutation({
    mutationFn: ({ deviceId, channelId }: { deviceId: string; channelId: string | null }) =>
      assignDeviceChannel(deviceId, channelId),
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: (deviceId: string) => removeDevice(deviceId),
    onSuccess: refresh,
  });

  return { assign, remove };
}
