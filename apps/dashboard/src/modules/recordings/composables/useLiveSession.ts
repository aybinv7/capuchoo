import { useQuery } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { queryKeys } from "@/shared/api/query-keys";
import { fetchLatestRecording } from "../services/recordings.service";

/** Covers an app stream that is down while a device is expected to start streaming. */
const WAITING_POLL_MS = 4000;

/**
 * The session a device is streaming right now, looked for only while `watching` - its live window
 * is open. The app stream refreshes it the moment the session starts; the poll is the fallback.
 */
export function useLiveSession(
  appId: MaybeRefOrGetter<string>,
  deviceId: MaybeRefOrGetter<string | null>,
  watching: MaybeRefOrGetter<boolean>,
) {
  const query = useQuery({
    queryKey: computed(() =>
      queryKeys.recordings(toValue(appId), { deviceId: toValue(deviceId), latest: true }),
    ),
    queryFn: ({ signal }) => fetchLatestRecording(toValue(appId), toValue(deviceId)!, signal),
    enabled: computed(() => Boolean(toValue(appId) && toValue(deviceId) && toValue(watching))),
    refetchInterval: (state) => (state.state.data?.live ? false : WAITING_POLL_MS),
  });

  return computed(() => {
    const latest = query.data.value;
    return latest?.live && toValue(watching) ? latest : null;
  });
}
