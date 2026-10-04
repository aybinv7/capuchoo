import { versionSpike } from "@capuchoo/core";
import type { appStats } from "../services/app-stats";
import type { recordingStats } from "../services/recording-summary";

export interface Attention {
  severity: "high" | "medium" | "info";
  kind: "regression" | "release" | "new_errors" | "delivery" | "recorder" | "live";
  summary: string;
  /** What to call next to look closer. */
  next: string;
}

const percent = (value: number) => `${Math.round(value * 1000) / 10}%`;

/**
 * What someone opening the app should look at first, from both its delivery and what its devices
 * recorded. The dashboard's Overview applies the same rules.
 */
export function attentionOf(
  delivery: Awaited<ReturnType<typeof appStats>>,
  recording: Awaited<ReturnType<typeof recordingStats>>,
): Attention[] {
  const items: Attention[] = [];
  for (const issue of recording.issues.top
    .filter((row) => row.status === "regressed")
    .slice(0, 2)) {
    items.push({
      severity: "high",
      kind: "regression",
      summary: `Error marked fixed came back: ${issue.message} (${issue.sessions} sessions, ${issue.devices} devices)`,
      next: `error_details { error: "${issue.id}" }`,
    });
  }
  const spike = versionSpike(recording.versions);
  if (spike) {
    items.push({
      severity: "high",
      kind: "release",
      summary: `${spike.version} hits errors in ${percent(spike.rate)} of sessions, against ${percent(spike.baseline)} for earlier versions`,
      next: `list_sessions { version: "${spike.version}", errors_only: true }`,
    });
  }
  if (recording.issues.new > 0) {
    items.push({
      severity: "medium",
      kind: "new_errors",
      summary: `${recording.issues.new} errors seen for the first time in the last ${recording.days} days`,
      next: "list_errors",
    });
  }
  for (const channel of delivery.channels.filter((row) => row.failures_24h > 0).slice(0, 2)) {
    items.push({
      severity: "medium",
      kind: "delivery",
      summary: `${channel.name ?? channel.channel_id}: ${channel.failures_24h} failed installs in 24 hours`,
      next: `channel_details { channel: "${channel.channel_id}" }`,
    });
  }
  if (recording.recorders.degraded > 0) {
    items.push({
      severity: "medium",
      kind: "recorder",
      summary: `${recording.recorders.degraded} recorders are dropping recordings (storage full or uploads failing)`,
      next: 'app_stats { view: "sessions" }',
    });
  }
  if (recording.totals.live_now > 0) {
    items.push({
      severity: "info",
      kind: "live",
      summary: `${recording.totals.live_now} sessions streaming now`,
      next: "list_sessions",
    });
  }
  return items;
}
