import { useQuery } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { queryKeys } from "@/shared/api/query-keys";
import { fetchRecording } from "../services/recordings.service";

/** Live sessions are refetched by the app stream; this poll only covers a stream that is down. */
const LIVE_FALLBACK_MS = 4000;

export function useRecording(
  appId: MaybeRefOrGetter<string>,
  recordingId: MaybeRefOrGetter<string>,
) {
  return useQuery({
    queryKey: computed(() => queryKeys.recording(toValue(appId), toValue(recordingId))),
    queryFn: ({ signal }) => fetchRecording(toValue(recordingId), signal),
    enabled: computed(() => Boolean(toValue(appId) && toValue(recordingId))),
    refetchInterval: (query) => (query.state.data?.session.live ? LIVE_FALLBACK_MS : false),
  });
}
