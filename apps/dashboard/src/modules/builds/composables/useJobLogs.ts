import { useQuery } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { queryKeys } from "@/shared/api/query-keys";
import type { BuildJob } from "@/shared/types/build";
import { shouldFetchLogs } from "../lib/job-logs";
import { fetchJobLogs } from "../services/job-logs.service";
import type { JobLogs } from "../types/job-logs.types";

const RECHECK_MS = 15_000;

export interface JobLogsOptions {
  buildId: MaybeRefOrGetter<string>;
  job: MaybeRefOrGetter<BuildJob | null>;
  /** Something on screen needs the lines: a step is open or a search is typed. */
  wanted: MaybeRefOrGetter<boolean>;
}

/**
 * One job's log, fetched the first time a step is opened and never while the job runs - the
 * provider only publishes it at the end. A finished job's log does not change, so it is never
 * refetched; an attempt is part of the key, so a re-run reads its own log.
 */
export function useJobLogs(options: JobLogsOptions) {
  const job = computed(() => toValue(options.job));

  return useQuery({
    queryKey: computed(() =>
      queryKeys.jobLogs(toValue(options.buildId), job.value?.id ?? "", job.value?.attempt ?? 0),
    ),
    queryFn: ({ signal }) => fetchJobLogs(toValue(options.buildId), job.value?.id ?? "", signal),
    enabled: computed(() => shouldFetchLogs(job.value, toValue(options.wanted))),
    staleTime: (query) => {
      const data = query.state.data as JobLogs | undefined;
      return data && !data.available && data.reason === "running" ? RECHECK_MS : Infinity;
    },
    refetchOnWindowFocus: false,
    gcTime: 10 * 60_000,
  });
}
