import { queryKeys } from "../api/query-keys";
import type { Build, BuildDetail, BuildEvent } from "../types/build";
import type { Channel, ChannelDetail, ReleaseCatalog } from "../types/release";
import { normalizeBuild, normalizeBuildEvent, normalizeChannel } from "./normalize";

export type CacheKey = readonly unknown[];

/** A pure instruction for the query cache. `update` only transforms data that is already cached. */
export type CacheOp =
  | { op: "update"; key: CacheKey; update: (current: unknown) => unknown }
  | { op: "invalidate"; key: CacheKey; throttle: boolean };

export interface StreamMessage {
  type: string;
  data: unknown;
}

const BUILD_LIST_CAP = 200;

function update<T>(key: CacheKey, transform: (current: T) => T): CacheOp {
  return {
    op: "update",
    key,
    update: (current) => (current === undefined ? undefined : transform(current as T)),
  };
}

const invalidate = (key: CacheKey, throttle = false): CacheOp => ({
  op: "invalidate",
  key,
  throttle,
});

function upsertById<T extends { id: string }>(list: readonly T[], item: T): T[] {
  const index = list.findIndex((entry) => entry.id === item.id);
  if (index === -1) return [...list, item];
  const next = [...list];
  next[index] = item;
  return next;
}

const byName = (a: Channel, b: Channel) => a.name.localeCompare(b.name);
const newestFirst = (a: Build, b: Build) => b.created_at.localeCompare(a.created_at);
const eventOrder = (a: BuildEvent, b: BuildEvent) => Number(a.id) - Number(b.id);

function channelOps(appId: string, data: unknown): CacheOp[] {
  const channel = normalizeChannel(data);
  if (!channel || channel.app_id !== appId) return [];
  return [
    update<ReleaseCatalog>(queryKeys.catalog(appId), (catalog) => ({
      ...catalog,
      channels: upsertById(catalog.channels, channel).sort(byName),
    })),
    update<ChannelDetail>(queryKeys.channel(channel.id), (detail) => ({ ...detail, ...channel })),
    invalidate(queryKeys.channel(channel.id)),
    invalidate(queryKeys.channelHistory(channel.id)),
    invalidate(queryKeys.statsAll(appId), true),
  ];
}

function buildOps(appId: string, data: unknown): CacheOp[] {
  const build = normalizeBuild(data);
  if (!build || build.app_id !== appId) return [];
  return [
    update<Build[]>(queryKeys.builds(appId), (builds) =>
      upsertById(builds, { ...builds.find((entry) => entry.id === build.id), ...build })
        .sort(newestFirst)
        .slice(0, BUILD_LIST_CAP),
    ),
    update<BuildDetail>(queryKeys.build(build.id), (detail) => ({
      ...detail,
      ...build,
      events: detail.events,
    })),
  ];
}

function buildEventOps(data: unknown): CacheOp[] {
  const event = normalizeBuildEvent(data);
  if (!event) return [];
  return [
    update<BuildDetail>(queryKeys.build(event.build_id), (detail) =>
      detail.events.some((entry) => entry.id === event.id)
        ? detail
        : { ...detail, events: [...detail.events, event].sort(eventOrder) },
    ),
  ];
}

/**
 * Turns one `GET /api/apps/:id/stream` message into cache operations. Events that carry a whole
 * entity update it in place; events that only name a change invalidate, throttled when they arrive
 * in bursts (device telemetry).
 */
export function reduceStreamEvent(appId: string, message: StreamMessage): CacheOp[] {
  switch (message.type) {
    case "channel":
      return channelOps(appId, message.data);
    case "build":
      return buildOps(appId, message.data);
    case "build_event":
      return buildEventOps(message.data);
    case "artefact":
      return [invalidate(queryKeys.catalog(appId))];
    case "device":
      return [
        invalidate(queryKeys.devicesAll(appId), true),
        invalidate(queryKeys.statsAll(appId), true),
      ];
    default:
      return [];
  }
}
