import { useQuery } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { queryKeys } from "../api/query-keys";
import { fetchLatestSessions } from "../services/recording-insight.service";

/** The newest sessions of an app, or of one device when `deviceId` is given. */
export function useLatestSessions(
  appId: MaybeRefOrGetter<string>,
  options: { deviceId?: MaybeRefOrGetter<string | null>; limit?: number } = {},
) {
  const limit = options.limit ?? 5;
  const deviceId = () => toValue(options.deviceId) ?? null;
  return useQuery({
    queryKey: computed(() => queryKeys.latestSessions(toValue(appId), deviceId(), limit)),
    queryFn: ({ signal }) =>
      fetchLatestSessions(toValue(appId), { limit, deviceId: deviceId() ?? undefined }, signal),
    enabled: computed(() => Boolean(toValue(appId))),
    staleTime: 30_000,
  });
}
