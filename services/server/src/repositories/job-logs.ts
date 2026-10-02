import type { Db } from "../db/database";
import type { BuildJob } from "../db/schema";

export function findJob(db: Db, buildId: string, jobId: string): Promise<BuildJob | undefined> {
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) return Promise.resolve(undefined);
  return db
    .selectFrom("build_jobs")
    .selectAll()
    .where("build_id", "=", buildId)
    .where("id", "=", jobId)
    .executeTakeFirst();
}

export function findJobLog(db: Db, jobId: string) {
  return db
    .selectFrom("build_job_logs")
    .select(["content", "truncated"])
    .where("job_id", "=", jobId)
    .executeTakeFirst();
}

export async function archiveJobLog(
  db: Db,
  jobId: string,
  content: string,
  truncated: boolean,
): Promise<void> {
  await db
    .insertInto("build_job_logs")
    .values({ job_id: jobId, content, truncated })
    .onConflict((oc) => oc.column("job_id").doNothing())
    .execute();
}
