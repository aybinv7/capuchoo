import { mergeJobStatus, type JobStatus, type PipelineStep } from "@capuchoo/core";
import type { Db } from "../db/database";
import type { BuildJob } from "../db/schema";

export interface JobReport {
  buildId: string;
  externalId: string;
  planKey: string | null;
  name: string;
  stage: string | null;
  status: JobStatus;
  attempt: number;
  url: string | null;
  runner: string | null;
  steps: PipelineStep[] | null;
  startedAt: Date | null;
  finishedAt: Date | null;
}

/**
 * Records one report of a job. Reports arrive out of order, so the stored status only moves
 * forward and a report never erases what an earlier one knew (steps, runner, start time).
 */
export async function upsertBuildJob(db: Db, report: JobReport): Promise<BuildJob> {
  return db.transaction().execute(async (trx) => {
    const inserted = await trx
      .insertInto("build_jobs")
      .values({
        build_id: report.buildId,
        external_id: report.externalId,
        plan_key: report.planKey,
        name: report.name,
        stage: report.stage,
        status: report.status,
        attempt: report.attempt,
        url: report.url,
        runner: report.runner,
        steps: JSON.stringify(report.steps ?? []),
        started_at: report.startedAt,
        finished_at: report.finishedAt,
      })
      .onConflict((oc) => oc.columns(["build_id", "external_id"]).doNothing())
      .returningAll()
      .executeTakeFirst();
    if (inserted) return inserted;

    const current = await trx
      .selectFrom("build_jobs")
      .selectAll()
      .where("build_id", "=", report.buildId)
      .where("external_id", "=", report.externalId)
      .forUpdate()
      .executeTakeFirstOrThrow();

    const status = mergeJobStatus(current.status, report.status);
    const advanced = status === report.status;
    return trx
      .updateTable("build_jobs")
      .set({
        status,
        plan_key: report.planKey ?? current.plan_key,
        name: report.name,
        stage: report.stage ?? current.stage,
        url: report.url ?? current.url,
        runner: report.runner ?? current.runner,
        ...(report.steps && advanced ? { steps: JSON.stringify(report.steps) } : {}),
        started_at: current.started_at ?? report.startedAt,
        finished_at: advanced ? (report.finishedAt ?? current.finished_at) : current.finished_at,
        updated_at: new Date(),
      })
      .where("id", "=", current.id)
      .returningAll()
      .executeTakeFirstOrThrow();
  });
}

export function listBuildJobs(db: Db, buildId: string): Promise<BuildJob[]> {
  return db
    .selectFrom("build_jobs")
    .selectAll()
    .where("build_id", "=", buildId)
    .orderBy("started_at", (ob) => ob.asc().nullsLast())
    .orderBy("created_at")
    .execute();
}

export function setJobPlanKey(db: Db, id: string, planKey: string): Promise<BuildJob> {
  return db
    .updateTable("build_jobs")
    .set({ plan_key: planKey, updated_at: new Date() })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirstOrThrow();
}
