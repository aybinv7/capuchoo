import type { Deps } from "../http/context";
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

/** What session recording saw in an app over `days`: the counterpart of `appStats`. */
export async function recordingStats(deps: Deps, appId: string, days: number) {
  const now = deps.now();
  const since = new Date(now.getTime() - days * 86_400_000);
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
  return {
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
  };
}
