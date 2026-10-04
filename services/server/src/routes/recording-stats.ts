import { Hono } from "hono";
import { requireApp } from "../access/app-access";
import { queryInt } from "../http/body";
import { principal, type AppEnv } from "../http/context";
import { LIVE_WINDOW_MS } from "../http/recording-serializers";
import { RECORDER_ONLINE_MS } from "../repositories/recorder-health";
import {
  dailySessions,
  issueCounts,
  liveRuleCount,
  recorderCounts,
  sessionStarts,
  sessionTotals,
  topIssues,
  versionQuality,
} from "../repositories/recording-stats";

const DAY_MS = 86_400_000;

/** What session recording saw in an app over a window: the counterpart of `/apps/:id/stats`. */
export function recordingStatsRoutes() {
  const router = new Hono<AppEnv>();

  router.get("/apps/:id/recording-stats", async (c) => {
    const deps = c.get("deps");
    const access = await requireApp(
      deps.db,
      principal(c),
      c.req.param("id"),
      "viewer",
      "Reading recording statistics",
    );
    const days = queryInt(c, "days", 30, 1, 365);
    const now = deps.now();
    const since = new Date(now.getTime() - days * DAY_MS);
    const appId = access.app.id;
    const [totals, daily, starts, versions, issues, top, recorders, liveRules] = await Promise.all([
      sessionTotals(deps.db, appId, since, new Date(now.getTime() - LIVE_WINDOW_MS)),
      dailySessions(deps.db, appId, since),
      sessionStarts(deps.db, appId, since),
      versionQuality(deps.db, appId, since),
      issueCounts(deps.db, appId, since),
      topIssues(deps.db, appId, since),
      recorderCounts(deps.db, appId, new Date(now.getTime() - RECORDER_ONLINE_MS)),
      liveRuleCount(deps.db, appId, now),
    ]);
    return c.json({
      days,
      totals: {
        ...totals,
        error_rate: totals.sessions ? totals.error_sessions / totals.sessions : null,
        avg_duration_ms: totals.sessions ? Math.round(totals.duration_ms / totals.sessions) : null,
      },
      daily,
      starts,
      versions,
      issues: { ...issues, top },
      recorders: { ...recorders, live_rules: liveRules },
    });
  });

  return router;
}
