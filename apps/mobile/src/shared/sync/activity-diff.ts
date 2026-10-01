import type { ActivityTable, ChannelTable, NativeBuildTable } from "@/shared/database/schema";

export interface Snapshot {
  channels: Pick<ChannelTable, "id" | "name" | "environment" | "paused" | "current_native_id">[];
  natives: Pick<
    NativeBuildTable,
    "id" | "version_name" | "version_code" | "flavour" | "created_at"
  >[];
}

/**
 * What changed for one app between two syncs, as activity. The ids are the facts themselves - a
 * build's id, a channel's id and the build it moved to - so the same change seen again by the live
 * stream, or by a second sync, is the same row. A first sync (no previous snapshot) records the
 * builds it finds but no deliveries: it cannot tell a move from a state it never saw before.
 */
export function diffActivity(
  appId: string,
  previous: Snapshot | null,
  next: Snapshot,
  at: string,
): ActivityTable[] {
  const rows: ActivityTable[] = [];
  const known = new Set(previous?.natives.map((native) => native.id) ?? []);
  const byId = new Map(next.natives.map((native) => [native.id, native]));

  for (const native of next.natives) {
    if (previous && known.has(native.id)) continue;
    rows.push({
      id: `build:${native.id}`,
      app_id: appId,
      kind: "build",
      version_name: native.version_name,
      version_code: native.version_code,
      channel_name: null,
      environment: native.flavour,
      detail: null,
      created_at: native.created_at,
      read_at: previous ? null : at,
    });
  }

  if (!previous) return rows;

  const before = new Map(previous.channels.map((channel) => [channel.id, channel]));
  for (const channel of next.channels) {
    const old = before.get(channel.id);
    if (!old) continue;

    if (channel.current_native_id && channel.current_native_id !== old.current_native_id) {
      const target = byId.get(channel.current_native_id);
      const prior = old.current_native_id ? byId.get(old.current_native_id) : undefined;
      const rolledBack = Boolean(target && prior && target.version_code < prior.version_code);
      rows.push({
        id: `point:${channel.id}:${channel.current_native_id}`,
        app_id: appId,
        kind: rolledBack ? "rolled_back" : "delivered",
        version_name: target?.version_name ?? null,
        version_code: target?.version_code ?? null,
        channel_name: channel.name,
        environment: channel.environment,
        detail: prior ? `${prior.version_name} (${prior.version_code})` : null,
        created_at: at,
        read_at: null,
      });
    }

    if (channel.paused !== old.paused) {
      rows.push({
        id: `${channel.paused ? "pause" : "resume"}:${channel.id}:${at}`,
        app_id: appId,
        kind: channel.paused ? "paused" : "resumed",
        version_name: null,
        version_code: null,
        channel_name: channel.name,
        environment: channel.environment,
        detail: null,
        created_at: at,
        read_at: null,
      });
    }
  }
  return rows;
}
