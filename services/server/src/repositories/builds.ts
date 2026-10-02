import { isTerminalBuildStatus, mergeBuildStatus } from "@capuchoo/core";
import type { Db } from "../db/database";
import type { Build, BuildEvent, BuildStatus, BuildsTable } from "../db/schema";
import type { Insertable, Updateable } from "kysely";

/** Every column but the plan, which only the detail view needs. */
export const BUILD_LIST_COLUMNS = [
  "id",
  "app_id",
  "channel_id",
  "channel_name",
  "kind",
  "status",
  "version_name",
  "version_code",
  "flavour",
  "source",
  "external_id",
  "commit_sha",
  "ref",
  "pipeline_url",
  "job_url",
  "actor_user_id",
  "actor_api_key_id",
  "bundle_id",
  "native_id",
  "error",
  "started_at",
  "finished_at",
  "created_at",
  "parent_id",
  "job_key",
  "run_attempt",
  "workflow",
  "title",
  "trigger",
  "updated_at",
] as const;

export type BuildSummary = Omit<Build, "plan">;

export interface RunReport {
  app_id: string;
  source: Build["source"];
  external_id: string;
  status: BuildStatus;
  run_attempt?: number | null;
  commit_sha?: string | null;
  ref?: string | null;
  pipeline_url?: string | null;
  title?: string | null;
  workflow?: string | null;
  trigger?: string | null;
  error?: string | null;
  started_at?: Date | null;
  finished_at?: Date | null;
  actor_user_id?: string | null;
  actor_api_key_id?: string | null;
}

const RUN_FIELDS = ["commit_sha", "ref", "pipeline_url", "workflow", "trigger"] as const;
/** Set once: a dispatched run keeps the title and actor it was started with. */
const FILL_ONLY = ["title", "actor_user_id", "actor_api_key_id"] as const;

export function createBuild(db: Db, row: Insertable<BuildsTable>): Promise<Build> {
  return db.insertInto("builds").values(row).returningAll().executeTakeFirstOrThrow();
}

/**
 * Creates or advances the run a provider reported. A report only fills what it knows, the status
 * never moves backwards within an attempt, and a finished run keeps its finish time.
 */
export async function upsertRun(
  db: Db,
  report: RunReport,
): Promise<{ build: Build; changed: boolean }> {
  return db.transaction().execute(async (trx) => {
    const terminal = isTerminalBuildStatus(report.status);
    const inserted = await trx
      .insertInto("builds")
      .values({
        app_id: report.app_id,
        kind: "pipeline",
        status: report.status,
        source: report.source,
        external_id: report.external_id,
        run_attempt: report.run_attempt ?? null,
        commit_sha: report.commit_sha ?? null,
        ref: report.ref ?? null,
        pipeline_url: report.pipeline_url ?? null,
        title: report.title ?? null,
        workflow: report.workflow ?? null,
        trigger: report.trigger ?? null,
        error: terminal ? (report.error ?? null) : null,
        started_at: report.started_at ?? null,
        finished_at: terminal ? (report.finished_at ?? new Date()) : null,
        actor_user_id: report.actor_user_id ?? null,
        actor_api_key_id: report.actor_api_key_id ?? null,
      })
      .onConflict((oc) =>
        oc
          .columns(["app_id", "source", "external_id"])
          .where("external_id", "is not", null)
          .doNothing(),
      )
      .returningAll()
      .executeTakeFirst();
    if (inserted) return { build: inserted, changed: true };

    const current = await trx
      .selectFrom("builds")
      .selectAll()
      .where("app_id", "=", report.app_id)
      .where("source", "=", report.source)
      .where("external_id", "=", report.external_id)
      .forUpdate()
      .executeTakeFirstOrThrow();

    const attempt = report.run_attempt ?? current.run_attempt;
    const restarted = (attempt ?? 0) > (current.run_attempt ?? 0);
    const status = mergeBuildStatus(current.status, report.status, {
      current: current.run_attempt,
      incoming: attempt,
    });
    const accepted = status === report.status;
    const finished = isTerminalBuildStatus(status);

    const patch: Updateable<BuildsTable> = { status, run_attempt: attempt };
    for (const field of RUN_FIELDS) {
      const value = report[field];
      if (value !== undefined && value !== null && value !== current[field]) patch[field] = value;
    }
    for (const field of FILL_ONLY) {
      const value = report[field];
      if (current[field] === null && value !== undefined && value !== null) patch[field] = value;
    }
    if (!current.started_at && report.started_at) patch.started_at = report.started_at;
    if (restarted) patch.started_at = report.started_at ?? current.started_at;
    patch.error = finished ? (accepted ? (report.error ?? null) : current.error) : null;
    patch.finished_at = finished
      ? accepted && (restarted || !current.finished_at)
        ? (report.finished_at ?? new Date())
        : current.finished_at
      : null;

    const changed = Object.entries(patch).some(([key, value]) => {
      const before = (current as Record<string, unknown>)[key];
      return value instanceof Date && before instanceof Date
        ? value.getTime() !== before.getTime()
        : value !== before;
    });
    if (!changed) return { build: current, changed: false };
    const build = await trx
      .updateTable("builds")
      .set({ ...patch, updated_at: new Date() })
      .where("id", "=", current.id)
      .returningAll()
      .executeTakeFirstOrThrow();
    return { build, changed: true };
  });
}

export async function setRunPlan(db: Db, buildId: string, plan: unknown): Promise<void> {
  await db
    .updateTable("builds")
    .set({ plan: JSON.stringify(plan), updated_at: new Date() })
    .where("id", "=", buildId)
    .execute();
}

export function findRunByExternalId(
  db: Db,
  appId: string,
  source: Build["source"],
  externalId: string,
): Promise<Build | undefined> {
  return db
    .selectFrom("builds")
    .selectAll()
    .where("app_id", "=", appId)
    .where("source", "=", source)
    .where("external_id", "=", externalId)
    .executeTakeFirst();
}

export function findBuild(db: Db, id: string): Promise<Build | undefined> {
  return db.selectFrom("builds").selectAll().where("id", "=", id).executeTakeFirst();
}

export function addBuildEvent(
  db: Db,
  input: { buildId: string; step: string; status: BuildEvent["status"]; message: string | null },
): Promise<BuildEvent> {
  return db
    .insertInto("build_events")
    .values({
      build_id: input.buildId,
      step: input.step,
      status: input.status,
      message: input.message,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function setBuildStatus(
  db: Db,
  id: string,
  patch: {
    status: BuildStatus;
    error?: string | null;
    bundle_id?: string | null;
    native_id?: string | null;
    started_at?: Date;
    finished_at?: Date;
  },
): Promise<Build> {
  return db
    .updateTable("builds")
    .set({ ...patch, updated_at: new Date() })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function listBuilds(
  db: Db,
  appId: string,
  limit: number,
  options: { topLevel?: boolean } = {},
) {
  let query = db
    .selectFrom("builds")
    .leftJoin("users", "users.id", "builds.actor_user_id")
    .select(BUILD_LIST_COLUMNS.map((column) => `builds.${column}` as const))
    .select("users.email as actor_email")
    .select((eb) =>
      eb
        .selectFrom("builds as child")
        .whereRef("child.parent_id", "=", "builds.id")
        .select((inner) => inner.fn.countAll<string>().as("count"))
        .as("child_count"),
    )
    .where("builds.app_id", "=", appId);
  if (options.topLevel) query = query.where("builds.parent_id", "is", null);
  const rows = await query.orderBy("builds.created_at", "desc").limit(limit).execute();
  return rows.map((row) => ({ ...row, child_count: Number(row.child_count ?? 0) }));
}

export function listChildBuilds(db: Db, parentId: string) {
  return db
    .selectFrom("builds")
    .select(BUILD_LIST_COLUMNS)
    .where("parent_id", "=", parentId)
    .orderBy("created_at")
    .execute();
}

export function listBuildEvents(db: Db, buildId: string) {
  return db
    .selectFrom("build_events")
    .selectAll()
    .where("build_id", "=", buildId)
    .orderBy("id")
    .execute();
}

/**
 * Deploys left running by a crashed CLI are closed after the timeout. Every deploy counts, not
 * only local ones: a deploy inside a CI job reports `source = github | gitlab` and used to stay
 * open forever when its runner died.
 */
export async function expireStaleBuilds(db: Db, olderThan: Date, now: Date): Promise<number> {
  const result = await db
    .updateTable("builds")
    .set({
      status: "failed",
      error: "No progress reported before the timeout",
      finished_at: now,
      updated_at: now,
    })
    .where("status", "in", ["queued", "running"])
    .where("kind", "in", ["ota", "native"])
    .where("created_at", "<", olderThan)
    .executeTakeFirst();
  return Number(result.numUpdatedRows);
}

/** Runs no provider has reported on for a day are closed, so a missed webhook cannot pin one open. */
export async function expireStalePipelines(db: Db, olderThan: Date, now: Date): Promise<number> {
  const result = await db
    .updateTable("builds")
    .set({
      status: "failed",
      error: "No update from the CI provider for 24 hours",
      finished_at: now,
      updated_at: now,
    })
    .where("kind", "=", "pipeline")
    .where("status", "in", ["queued", "running"])
    .where("updated_at", "<", olderThan)
    .executeTakeFirst();
  return Number(result.numUpdatedRows);
}
