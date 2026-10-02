import { mergeJobStatus, parsePipelinePlan } from "@capuchoo/core";
import { queryKeys } from "../api/query-keys";
import type { Build, BuildChild, BuildDetail, BuildEvent, BuildJob } from "../types/build";
import type { Channel, ChannelDetail, ReleaseCatalog } from "../types/release";
import {
  normalizeBuild,
  normalizeBuildEvent,
  normalizeBuildJob,
  normalizeChannel,
} from "./normalize";

export type CacheKey = readonly unknown[];

/**
 * A pure instruction for the query cache. `update` only transforms data that is already cached;
 * `updateMatching` offers every cached query under `prefix` to `update`, which returns undefined
 * for the ones it leaves alone.
 */
export type CacheOp =
  | { op: "update"; key: CacheKey; update: (current: unknown) => unknown }
  | { op: "updateMatching"; prefix: CacheKey; update: (current: unknown) => unknown }
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
  return replaceById(list, item) ?? [...list, item];
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

function replaceById<T extends { id: string }>(list: readonly T[], item: T): T[] | null {
  const index = list.findIndex((entry) => entry.id === item.id);
  if (index === -1) return null;
  const next = [...list];
  next[index] = item;
  return next;
}

function buildOps(appId: string, data: unknown): CacheOp[] {
  const build = normalizeBuild(data);
  if (!build || build.app_id !== appId) return [];
  const plan = parsePipelinePlan((data as Record<string, unknown>).plan);
  const ops: CacheOp[] = [
    update<Build[]>(queryKeys.builds(appId), (builds) => {
      const merged = { ...builds.find((entry) => entry.id === build.id), ...build };
      if (build.parent_id) return replaceById(builds, merged) ?? builds;
      return upsertById(builds, merged).sort(newestFirst).slice(0, BUILD_LIST_CAP);
    }),
    update<BuildDetail>(queryKeys.build(build.id), (detail) => ({
      ...detail,
      ...build,
      events: detail.events,
      jobs: detail.jobs,
      plan: plan ?? detail.plan,
      children: detail.children,
    })),
  ];
  if (build.parent_id) {
    ops.push(
      update<BuildDetail>(queryKeys.build(build.parent_id), (parent) => {
        const known = parent.children.find((entry) => entry.id === build.id);
        const child: BuildChild = { ...known, ...build, events: known?.events ?? [] };
        return {
          ...parent,
          children: upsertById(parent.children, child).sort((a, b) =>
            a.created_at.localeCompare(b.created_at),
          ),
        };
      }),
    );
    const channelId = build.channel_id;
    const parentId = build.parent_id;
    if (channelId)
      ops.push(update<Build[]>(queryKeys.builds(appId), withTarget(parentId, channelId)));
  }
  return ops;
}

/** A child deploy's channel joins its run's targets in the list, so the canvas links them live. */
function withTarget(runId: string, channelId: string) {
  return (builds: Build[]): Build[] => {
    const run = builds.find((entry) => entry.id === runId);
    if (!run || run.target_channel_ids?.includes(channelId)) return builds;
    const target_channel_ids = [...(run.target_channel_ids ?? []), channelId];
    return replaceById(builds, { ...run, target_channel_ids }) ?? builds;
  };
}

/**
 * The job to keep when a report arrives. A later attempt replaces the row; an earlier one is
 * stale. Within one attempt the status never regresses, so a redelivered `queued` after
 * `running` leaves the row as it was.
 */
export function mergeJob(current: BuildJob | undefined, incoming: BuildJob): BuildJob {
  if (!current || incoming.attempt > current.attempt) return incoming;
  if (incoming.attempt < current.attempt) return current;
  const status = mergeJobStatus(current.status, incoming.status);
  if (status !== incoming.status) return current;
  return incoming;
}

function buildJobOps(data: unknown): CacheOp[] {
  const job = normalizeBuildJob(data);
  if (!job) return [];
  return [
    update<BuildDetail>(queryKeys.build(job.build_id), (detail) => {
      const current = detail.jobs.find((entry) => entry.id === job.id);
      const next = mergeJob(current, job);
      if (next === current) return detail;
      return { ...detail, jobs: upsertById(detail.jobs, next) };
    }),
  ];
}

function withEvent<T extends { events: BuildEvent[] }>(holder: T, event: BuildEvent): T {
  if (holder.events.some((entry) => entry.id === event.id)) return holder;
  return { ...holder, events: [...holder.events, event].sort(eventOrder) };
}

function buildEventOps(data: unknown): CacheOp[] {
  const event = normalizeBuildEvent(data);
  if (!event) return [];
  return [
    update<BuildDetail>(queryKeys.build(event.build_id), (detail) => withEvent(detail, event)),
    {
      op: "updateMatching",
      prefix: queryKeys.buildDetails(),
      update: (current) => {
        const parent = current as BuildDetail | undefined;
        const index = parent?.children?.findIndex((child) => child.id === event.build_id) ?? -1;
        if (!parent || index === -1) return undefined;
        const child = parent.children[index]!;
        const next = withEvent(child, event);
        if (next === child) return undefined;
        const children = [...parent.children];
        children[index] = next;
        return { ...parent, children };
      },
    },
  ];
}

/** Telemetry refetches the lists and the activity feed, and the reporting device's own page. */
function deviceOps(appId: string, data: unknown): CacheOp[] {
  const ops = [
    invalidate(queryKeys.devicesAll(appId), true),
    invalidate(queryKeys.statsAll(appId), true),
    invalidate(queryKeys.activityAll(appId), true),
  ];
  const uuid =
    typeof data === "object" && data !== null
      ? (data as Record<string, unknown>).device_uuid
      : undefined;
  if (typeof uuid === "string" && uuid) ops.push(invalidate(queryKeys.device(appId, uuid), true));
  return ops;
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
    case "build_job":
      return buildJobOps(message.data);
    case "artefact":
      return [invalidate(queryKeys.catalog(appId))];
    case "device":
      return deviceOps(appId, message.data);
    default:
      return [];
  }
}
