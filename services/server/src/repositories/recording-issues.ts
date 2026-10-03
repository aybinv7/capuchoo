import type { RecordingIssue } from "@capuchoo/core";
import { sql, type Transaction } from "kysely";
import type { Db } from "../db/database";
import type { Database } from "../db/schema";

export type IssueStatus = "open" | "resolved" | "regressed";

export interface IssueOccurrence {
  appId: string;
  sessionId: string;
  deviceId: string;
  versionName: string;
  issues: readonly RecordingIssue[];
}

/**
 * Counts a segment's errors into their issues, inside the transaction that records the segment, so
 * a retried upload counts nothing twice. An occurrence of a resolved issue reopens it as regressed.
 */
export async function recordIssueOccurrences(
  trx: Transaction<Database>,
  occurrence: IssueOccurrence,
): Promise<void> {
  for (const issue of occurrence.issues) {
    const seen = new Date(issue.at);
    const row = await trx
      .insertInto("recording_issues")
      .values({
        app_id: occurrence.appId,
        fingerprint: issue.fingerprint,
        message: issue.message,
        frame: issue.frame,
        occurrences: issue.count,
        first_version: occurrence.versionName,
        last_version: occurrence.versionName,
        first_seen: seen,
        last_seen: seen,
      })
      .onConflict((conflict) =>
        conflict.columns(["app_id", "fingerprint"]).doUpdateSet({
          occurrences: sql`recording_issues.occurrences + ${issue.count}`,
          last_seen: sql`greatest(recording_issues.last_seen, ${seen})`,
          last_version: occurrence.versionName,
          frame: sql`coalesce(excluded.frame, recording_issues.frame)`,
          status: sql`case when recording_issues.status = 'resolved' then 'regressed' else recording_issues.status end`,
        }),
      )
      .returning("id")
      .executeTakeFirstOrThrow();

    await trx
      .insertInto("recording_issue_sessions")
      .values({
        issue_id: row.id,
        session_id: occurrence.sessionId,
        device_id: occurrence.deviceId,
        version_name: occurrence.versionName,
        first_at: seen,
        occurrences: issue.count,
      })
      .onConflict((conflict) =>
        conflict.columns(["issue_id", "session_id"]).doUpdateSet({
          occurrences: sql`recording_issue_sessions.occurrences + ${issue.count}`,
          first_at: sql`least(recording_issue_sessions.first_at, ${seen})`,
        }),
      )
      .execute();
  }
}

const ISSUE_COLUMNS = [
  "recording_issues.id",
  "recording_issues.fingerprint",
  "recording_issues.message",
  "recording_issues.frame",
  "recording_issues.status",
  "recording_issues.occurrences",
  "recording_issues.first_version",
  "recording_issues.last_version",
  "recording_issues.first_seen",
  "recording_issues.last_seen",
  "recording_issues.resolved_at",
] as const;

/** An app's issues, most recently seen first, with how many devices and sessions they reached. */
export function listIssues(
  db: Db,
  appId: string,
  filter: { status: "unresolved" | "resolved" | "all"; limit: number },
) {
  let query = db
    .selectFrom("recording_issues")
    .leftJoin("recording_issue_sessions as link", "link.issue_id", "recording_issues.id")
    .select(ISSUE_COLUMNS)
    .select((eb) => [
      eb.fn.count<string>("link.session_id").as("session_count"),
      eb.fn.count<string>(sql`distinct link.device_id`).as("device_count"),
    ])
    .where("recording_issues.app_id", "=", appId)
    .groupBy("recording_issues.id")
    .orderBy("recording_issues.last_seen", "desc")
    .limit(filter.limit);
  if (filter.status === "resolved") query = query.where("recording_issues.status", "=", "resolved");
  if (filter.status === "unresolved") {
    query = query.where("recording_issues.status", "!=", "resolved");
  }
  return query.execute();
}

export function findIssue(db: Db, id: string) {
  return db
    .selectFrom("recording_issues")
    .select([...ISSUE_COLUMNS, "recording_issues.app_id"])
    .where("id", "=", id)
    .executeTakeFirst();
}

/** The sessions an issue happened in, newest first, with when it first happened in each. */
export function issueSessions(db: Db, issueId: string, limit: number) {
  return db
    .selectFrom("recording_issue_sessions as link")
    .innerJoin("recording_sessions as session", "session.id", "link.session_id")
    .select([
      "session.id",
      "session.device_id",
      "session.device",
      "session.platform",
      "session.version_name",
      "session.started_at",
      "session.start",
      "session.note",
      "link.first_at",
      "link.occurrences",
    ])
    .where("link.issue_id", "=", issueId)
    .orderBy("link.first_at", "desc")
    .limit(limit)
    .execute();
}

export async function setIssueStatus(
  db: Db,
  id: string,
  status: "open" | "resolved",
  now: Date,
): Promise<void> {
  await db
    .updateTable("recording_issues")
    .set({ status, resolved_at: status === "resolved" ? now : null })
    .where("id", "=", id)
    .execute();
}

/** Issues nobody has hit since `cutoff`; their sessions went with retention already. */
export async function purgeIssues(db: Db, cutoff: Date): Promise<number> {
  const result = await db
    .deleteFrom("recording_issues")
    .where("last_seen", "<", cutoff)
    .executeTakeFirst();
  return Number(result.numDeletedRows);
}
