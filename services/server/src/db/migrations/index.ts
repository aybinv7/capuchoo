import type { Migration } from "kysely/migration";
import * as initial from "./0001_initial";
import * as ciProviders from "./0002_ci_providers";
import * as jobLogs from "./0003_job_logs";

/** Every migration, in order. Names are permanent once applied anywhere. */
export const migrations: Record<string, Migration> = {
  "0001_initial": initial,
  "0002_ci_providers": ciProviders,
  "0003_job_logs": jobLogs,
};
