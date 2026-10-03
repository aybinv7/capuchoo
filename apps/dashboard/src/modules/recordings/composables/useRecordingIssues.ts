import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { queryKeys } from "@/shared/api/query-keys";
import { notifyError } from "@/shared/lib/notify";
import { fetchIssues, setIssueStatus } from "../services/recordings.service";
import type { IssueFilter } from "../types/recordings.types";

/** Kept fresh by new segments over the app stream; the interval covers a dropped stream. */
const REFETCH_MS = 60_000;

export function useRecordingIssues(
  appId: MaybeRefOrGetter<string>,
  filter: MaybeRefOrGetter<IssueFilter>,
) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: computed(() => queryKeys.recordingIssues(toValue(appId), toValue(filter))),
    queryFn: ({ signal }) => fetchIssues(toValue(appId), toValue(filter), signal),
    enabled: computed(() => Boolean(toValue(appId))),
    refetchInterval: REFETCH_MS,
  });

  const status = useMutation({
    mutationFn: (input: { id: string; status: "open" | "resolved" }) =>
      setIssueStatus(input.id, input.status),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["apps", toValue(appId), "recordings", "issues"] }),
    onError: notifyError,
  });

  const issues = computed(() => query.data.value ?? []);
  return { query, issues, status };
}
