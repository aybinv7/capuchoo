import type { RouteLocationRaw } from "vue-router";
import { formatCount, formatPercent, ratio } from "@/shared/lib/format";
import { versionSpike } from "@/shared/recording/quality";
import { RouteName } from "@/shared/router/route-names";
import type { RecordingStats } from "@/shared/types/recording-stats";
import type { AppStats } from "@/shared/types/stats";

export type AttentionTone = "danger" | "warning" | "info";

export interface AttentionItem {
  id: string;
  tone: AttentionTone;
  kind: "regression" | "release" | "errors" | "delivery" | "recorder" | "live";
  title: string;
  detail: string;
  to: RouteLocationRaw;
}

const ORDER: Record<AttentionTone, number> = { danger: 0, warning: 1, info: 2 };
const MAX_ITEMS = 6;
const MAX_REGRESSIONS = 2;
const MAX_CHANNELS = 2;
/** Below this many attempts an install success rate says nothing. */
const MIN_ATTEMPTS = 20;
const LOW_SUCCESS = 0.9;

const plural = (count: number, one: string, many = `${one}s`) =>
  `${formatCount(count)} ${count === 1 ? one : many}`;

/**
 * What someone opening the app should look at first, from both sides of it: errors that came back,
 * a release whose sessions break more than the last, new errors, channels failing installs, and
 * recorders that cannot keep up. Danger first; nothing when all is well.
 */
export function attentionItems(
  delivery: AppStats | null | undefined,
  recording: RecordingStats | null | undefined,
): AttentionItem[] {
  const items: AttentionItem[] = [];
  const days = recording?.days ?? delivery?.days ?? 14;

  for (const issue of (recording?.issues.top ?? [])
    .filter((row) => row.status === "regressed")
    .slice(0, MAX_REGRESSIONS)) {
    items.push({
      id: `regression:${issue.id}`,
      tone: "danger",
      kind: "regression",
      title: issue.message,
      detail: `Marked fixed, seen again · ${plural(issue.sessions, "session")} on ${plural(issue.devices, "device")}`,
      to: { name: RouteName.recordingIssues },
    });
  }

  const spike = versionSpike(recording?.versions ?? []);
  if (spike) {
    items.push({
      id: `release:${spike.version}`,
      tone: "danger",
      kind: "release",
      title: `${spike.version} hits errors in ${formatPercent(spike.rate)} of sessions`,
      detail: `Earlier versions: ${formatPercent(spike.baseline)} · ${plural(spike.sessions, "session")} on ${plural(spike.devices, "device")}`,
      to: { name: RouteName.recordings, query: { version: spike.version, errors: "1" } },
    });
  }

  const fresh = recording?.issues.new ?? 0;
  if (fresh > 0) {
    items.push({
      id: "errors:new",
      tone: "warning",
      kind: "errors",
      title: `${plural(fresh, "new error")} in the last ${days} days`,
      detail: "Seen for the first time in this window.",
      to: { name: RouteName.recordingIssues },
    });
  }

  const failing = [...(delivery?.channels ?? [])]
    .filter((channel) => channel.failures_24h > 0)
    .sort((a, b) => b.failures_24h - a.failures_24h)
    .slice(0, MAX_CHANNELS);
  for (const channel of failing) {
    const success = ratio(channel.installs_7d, channel.installs_7d + channel.failures_7d);
    items.push({
      id: `delivery:${channel.channel_id}`,
      tone: "warning",
      kind: "delivery",
      title: `${channel.name ?? "A channel"}: ${plural(channel.failures_24h, "failed install")} in 24 hours`,
      detail: `${formatPercent(success)} install success over 7 days · ${plural(channel.devices, "device")}`,
      to: { name: RouteName.channel, params: { channelId: channel.channel_id } },
    });
  }

  const totals = delivery?.totals;
  if (
    totals &&
    failing.length === 0 &&
    totals.success_rate !== null &&
    totals.installs + totals.failures >= MIN_ATTEMPTS &&
    totals.success_rate < LOW_SUCCESS
  ) {
    items.push({
      id: "delivery:success",
      tone: "warning",
      kind: "delivery",
      title: `Install success is ${formatPercent(totals.success_rate)} over ${delivery.days} days`,
      detail: `${plural(totals.failures, "failed install")} out of ${formatCount(totals.installs + totals.failures)}`,
      to: { name: RouteName.statistics },
    });
  }

  const degraded = recording?.recorders.degraded ?? 0;
  if (degraded > 0) {
    items.push({
      id: "recorder:degraded",
      tone: "warning",
      kind: "recorder",
      title: `${plural(degraded, "recorder")} ${degraded === 1 ? "is" : "are"} dropping recordings`,
      detail:
        "Storage filled up or uploads kept failing, so their newest sessions may be cut short.",
      to: { name: RouteName.recordingSetup },
    });
  }

  const live = recording?.totals.live_now ?? 0;
  if (live > 0) {
    items.push({
      id: "live",
      tone: "info",
      kind: "live",
      title: `${plural(live, "session")} streaming now`,
      detail: "Open one to follow the device as it happens.",
      to: { name: RouteName.recordings },
    });
  }

  return items.sort((a, b) => ORDER[a.tone] - ORDER[b.tone]).slice(0, MAX_ITEMS);
}
