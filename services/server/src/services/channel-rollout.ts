import type { Db } from "../db/database";
import type { Channel } from "../db/schema";
import { findBundle } from "../repositories/artefacts";
import {
  channelVersionMix,
  devicesBehind,
  firstDeliveriesPerDay,
  lastMoveTo,
} from "../repositories/channel-rollout";

const BEHIND_LIMIT = 8;
const MIX_LIMIT = 6;
const CURVE_DAYS = 60;

/**
 * How the channel's current bundle is landing: the version mix of its devices, the ones still
 * behind, and how many took the bundle on each day since it was delivered (cumulative).
 */
export async function channelRollout(db: Db, channel: Channel, tz: string, now: Date) {
  const bundle = channel.current_bundle_id
    ? await findBundle(db, channel.current_bundle_id)
    : undefined;
  const version = bundle?.version_name ?? null;
  const [mix, behind, move] = await Promise.all([
    channelVersionMix(db, channel.id),
    devicesBehind(db, channel.id, version, BEHIND_LIMIT),
    bundle ? lastMoveTo(db, channel.id, bundle.id) : undefined,
  ]);

  const devices = mix.reduce((sum, row) => sum + Number(row.devices), 0);
  const onCurrent = Number(mix.find((row) => row.version === version)?.devices ?? 0);
  const sorted = mix.map((row) => ({
    version: row.version,
    devices: Number(row.devices),
    current: row.version === version,
  }));
  const shown = sorted.slice(0, MIX_LIMIT);
  const rest = sorted.slice(MIX_LIMIT).reduce((sum, row) => sum + row.devices, 0);

  const deliveredAt = move ? new Date(move.created_at) : null;
  const since = deliveredAt
    ? new Date(Math.max(deliveredAt.getTime(), now.getTime() - CURVE_DAYS * 86_400_000))
    : null;
  const firsts =
    version && since
      ? await firstDeliveriesPerDay(db, { channelId: channel.id, version, since, tz })
      : [];
  let running = 0;
  const curve = firsts.map((row) => {
    running += Number(row.devices);
    return { day: row.day, devices: running };
  });

  return {
    current: bundle
      ? {
          bundle_id: bundle.id,
          version: bundle.version_name,
          delivered_at: deliveredAt?.toISOString() ?? null,
          delivered_by: move?.actor_email ?? null,
          from_version: move?.from_version ?? null,
          rollback: move?.action === "rollback_bundle",
        }
      : null,
    devices,
    on_current: onCurrent,
    mix: rest > 0 ? [...shown, { version: "other", devices: rest, current: false }] : shown,
    behind: behind.map((row) => ({
      ...row,
      last_seen_at: new Date(row.last_seen_at).toISOString(),
    })),
    curve,
    tz,
  };
}
