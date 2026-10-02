import { http } from "@/shared/api/http";
import { normalizeJobLogs } from "../lib/job-logs";

/** A job's log split into its steps; `jobId` is the job's row id, not the provider's. */
export const fetchJobLogs = (buildId: string, jobId: string, signal?: AbortSignal) =>
  http
    .get<unknown>(
      `/builds/${encodeURIComponent(buildId)}/jobs/${encodeURIComponent(jobId)}/logs`,
      undefined,
      signal,
    )
    .then(normalizeJobLogs);
