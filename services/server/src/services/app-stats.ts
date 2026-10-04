import type { Deps } from "../http/context";
import { appCounts } from "../repositories/apps";
import { listChannels } from "../repositories/channels";
import { channelHealth, dailyActivity, versionDistribution } from "../repositories/device-events";

/** Update checks, installs and failures over `days`, with each channel's health. */
export async function appStats(deps: Deps, appId: string, days: number) {
  const since = new Date(deps.now().getTime() - days * 86_400_000);
  const [daily, versions, health, channels, deviceTotal] = await Promise.all([
    dailyActivity(deps.db, appId, since),
    versionDistribution(deps.db, appId, since),
    channelHealth(deps.db, appId, deps.now()),
    listChannels(deps.db, appId),
    appCounts(deps.db, appId).then((counts) => counts.devices),
  ]);
  const totals = daily.reduce(
    (sum, day) => ({
      checks: sum.checks + day.checks,
      installs: sum.installs + day.installs,
      failures: sum.failures + day.failures,
    }),
    { checks: 0, installs: 0, failures: 0 },
  );
  return {
    days,
    totals: {
      ...totals,
      devices: deviceTotal,
      active_24h: health.reduce((sum, row) => sum + row.active_24h, 0),
      success_rate:
        totals.installs + totals.failures
          ? totals.installs / (totals.installs + totals.failures)
          : null,
    },
    daily,
    versions,
    channels: health.map((row) => ({
      ...row,
      name: channels.find((channel) => channel.id === row.channel_id)?.name ?? null,
    })),
  };
}
