import { Hono } from "hono";
import { requireApp } from "../access/app-access";
import { queryInt, readJson } from "../http/body";
import { principal, type AppEnv } from "../http/context";
import { badRequest, notFound } from "../lib/errors";
import { isUuid } from "../repositories/apps";
import {
  findIssue,
  issueSessions,
  listIssues,
  setIssueStatus,
} from "../repositories/recording-issues";

const STATUSES = new Set(["unresolved", "resolved", "all"]);

function serializeIssue(row: Awaited<ReturnType<typeof listIssues>>[number]) {
  return {
    id: row.id,
    fingerprint: row.fingerprint,
    message: row.message,
    frame: row.frame,
    status: row.status,
    occurrences: Number(row.occurrences),
    sessions: Number(row.session_count),
    devices: Number(row.device_count),
    first_version: row.first_version,
    last_version: row.last_version,
    first_seen: row.first_seen.toISOString(),
    last_seen: row.last_seen.toISOString(),
    resolved_at: row.resolved_at?.toISOString() ?? null,
  };
}

/** Errors grouped across sessions, each linked to the replays where it happened. */
export function recordingIssueRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get("/apps/:id/recording-issues", async (c) => {
    const deps = c.get("deps");
    const access = await requireApp(
      deps.db,
      principal(c),
      c.req.param("id"),
      "viewer",
      "Reading errors",
    );
    const status = c.req.query("status") ?? "unresolved";
    if (!STATUSES.has(status)) throw badRequest("status is unresolved, resolved or all");
    const rows = await listIssues(deps.db, access.app.id, {
      status: status as "unresolved" | "resolved" | "all",
      limit: queryInt(c, "limit", 100, 1, 200),
    });
    return c.json({ issues: rows.map(serializeIssue) });
  });

  router.get("/recording-issues/:id", async (c) => {
    const deps = c.get("deps");
    const id = c.req.param("id");
    if (!isUuid(id)) throw notFound("Error");
    const issue = await findIssue(deps.db, id);
    if (!issue) throw notFound("Error");
    await requireApp(deps.db, principal(c), issue.app_id, "viewer", "Reading errors");
    const sessions = await issueSessions(deps.db, id, 50);
    return c.json({
      sessions: sessions.map((session) => ({
        id: session.id,
        device_id: session.device_id,
        device: session.device,
        platform: session.platform,
        version_name: session.version_name,
        start: session.start,
        note: session.note,
        started_at: session.started_at.toISOString(),
        first_at: session.first_at.toISOString(),
        offset_ms: Math.max(0, session.first_at.getTime() - session.started_at.getTime()),
        occurrences: session.occurrences,
      })),
    });
  });

  router.patch("/recording-issues/:id", async (c) => {
    const deps = c.get("deps");
    const id = c.req.param("id");
    if (!isUuid(id)) throw notFound("Error");
    const issue = await findIssue(deps.db, id);
    if (!issue) throw notFound("Error");
    await requireApp(deps.db, principal(c), issue.app_id, "developer", "Resolving errors");
    const body = await readJson<{ status?: unknown }>(c, 1024);
    if (body.status !== "open" && body.status !== "resolved") {
      throw badRequest("status is open or resolved");
    }
    await setIssueStatus(deps.db, id, body.status, deps.now());
    return c.json({ id, status: body.status });
  });

  return router;
}
