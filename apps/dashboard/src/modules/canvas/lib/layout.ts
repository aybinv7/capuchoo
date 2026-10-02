import { channelCurrent } from "@/shared/delivery/lib/eligibility";
import { ENVIRONMENT_ORDER, compareReleaseChannels } from "@/shared/lib/channels";
import type { Build } from "@/shared/types/build";
import type { Channel, ReleaseCatalog } from "@/shared/types/release";
import type { ChannelStats } from "@/shared/types/stats";
import type { CanvasEdge, CanvasNode } from "../types/canvas.types";

export const LAYOUT = {
  channelWidth: 272,
  channelHeight: 196,
  buildWidth: 248,
  buildHeight: 132,
  columnGap: 96,
  rowGap: 28,
  laneTop: 0,
  contentTop: 56,
} as const;

export interface CanvasInput {
  catalog: ReleaseCatalog;
  stats: ReadonlyMap<string, ChannelStats>;
  builds: readonly Build[];
  /** How many of the latest builds to show in the builds column. */
  buildLimit?: number;
}

export interface CanvasGraph {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

const LANES = [
  { key: "builds", label: "Builds", hint: "latest CLI and pipeline runs" },
  { key: "dev", label: "dev", hint: "release channel" },
  { key: "staging", label: "staging", hint: "release channel" },
  { key: "prod", label: "prod", hint: "release channel" },
  { key: "clients", label: "Clients", hint: "follow a release channel" },
] as const;

type LaneKey = (typeof LANES)[number]["key"];

function columnX(lane: LaneKey): number {
  const index = LANES.findIndex((entry) => entry.key === lane);
  const buildColumn = LAYOUT.buildWidth + LAYOUT.columnGap;
  if (index === 0) return 0;
  return buildColumn + (index - 1) * (LAYOUT.channelWidth + LAYOUT.columnGap);
}

const rowY = (row: number, height: number) => LAYOUT.contentTop + row * (height + LAYOUT.rowGap);

function channelNode(
  channel: Channel,
  catalog: ReleaseCatalog,
  stats: ReadonlyMap<string, ChannelStats>,
  x: number,
  y: number,
): CanvasNode {
  const current = channelCurrent(channel, catalog);
  return {
    id: `channel:${channel.id}`,
    type: "channel",
    position: { x, y },
    data: {
      channel,
      bundle: current.bundle,
      native: current.native,
      stats: stats.get(channel.id) ?? null,
    },
    draggable: false,
    connectable: false,
  };
}

/**
 * The release map, deterministically: builds on the left, release channels in promotion order
 * (dev, staging, prod) as lanes, client channels in the last lane beside their base. Edges show
 * promotion between the first channel of each environment, each client's base, and the channel a
 * build targets. Same input, same picture: nothing is random and nothing depends on render order.
 */
export function buildCanvasGraph(input: CanvasInput): CanvasGraph {
  const { catalog, stats } = input;
  const nodes: CanvasNode[] = [];
  const edges: CanvasEdge[] = [];
  const releases = catalog.channels
    .filter((channel) => channel.kind === "release")
    .sort(compareReleaseChannels);
  const clients = catalog.channels.filter((channel) => channel.kind === "client");
  const placedY = new Map<string, number>();

  const visibleLanes = LANES.filter(
    (lane) =>
      lane.key === "builds" ||
      (lane.key === "clients"
        ? clients.length > 0
        : releases.some((channel) => channel.environment === lane.key)),
  );
  for (const lane of visibleLanes) {
    nodes.push({
      id: `lane:${lane.key}`,
      type: "lane",
      position: { x: columnX(lane.key), y: LAYOUT.laneTop },
      data: { label: lane.label, hint: lane.hint },
      draggable: false,
      selectable: false,
      connectable: false,
    });
  }

  for (const environment of ENVIRONMENT_ORDER) {
    releases
      .filter((channel) => channel.environment === environment)
      .forEach((channel, row) => {
        const y = rowY(row, LAYOUT.channelHeight);
        placedY.set(channel.id, y);
        nodes.push(channelNode(channel, catalog, stats, columnX(environment), y));
      });
  }

  const leads = ENVIRONMENT_ORDER.map((environment) =>
    releases.find((channel) => channel.environment === environment),
  ).filter((channel): channel is Channel => Boolean(channel));
  for (let index = 1; index < leads.length; index += 1) {
    const from = leads[index - 1]!;
    const to = leads[index]!;
    edges.push({
      id: `promote:${from.id}:${to.id}`,
      source: `channel:${from.id}`,
      target: `channel:${to.id}`,
      type: "smoothstep",
      class: "edge-promote",
      label: "promote",
    });
  }

  const orderedClients = [...clients].sort((a, b) => {
    const baseA = placedY.get(a.base_channel_id ?? "") ?? Number.POSITIVE_INFINITY;
    const baseB = placedY.get(b.base_channel_id ?? "") ?? Number.POSITIVE_INFINITY;
    return baseA - baseB || a.name.localeCompare(b.name);
  });
  orderedClients.forEach((channel, row) => {
    nodes.push(
      channelNode(channel, catalog, stats, columnX("clients"), rowY(row, LAYOUT.channelHeight)),
    );
    if (channel.base_channel_id && placedY.has(channel.base_channel_id)) {
      edges.push({
        id: `follows:${channel.base_channel_id}:${channel.id}`,
        source: `channel:${channel.base_channel_id}`,
        target: `channel:${channel.id}`,
        type: "smoothstep",
        class: "edge-follows",
      });
    }
  });

  const channelIds = new Set(catalog.channels.map((channel) => channel.id));
  input.builds.slice(0, input.buildLimit ?? 6).forEach((build, row) => {
    nodes.push({
      id: `build:${build.id}`,
      type: "build",
      position: { x: columnX("builds"), y: rowY(row, LAYOUT.buildHeight) },
      data: { build },
      draggable: false,
      connectable: false,
    });
    const running = build.status === "running" || build.status === "queued";
    const edgeClass = running
      ? "edge-build-live"
      : build.status === "failed"
        ? "edge-build-failed"
        : "edge-build";
    for (const channelId of buildTargets(build)) {
      if (!channelIds.has(channelId)) continue;
      edges.push({
        id: `build:${build.id}:${channelId}`,
        source: `build:${build.id}`,
        target: `channel:${channelId}`,
        type: "default",
        animated: running,
        class: edgeClass,
      });
    }
  });

  return { nodes, edges };
}

/**
 * Every channel a build reaches: its own target, then the channels its pipeline's deploys
 * published to, each once and in that order.
 */
export function buildTargets(build: Pick<Build, "channel_id" | "target_channel_ids">): string[] {
  const targets = new Set<string>();
  if (build.channel_id) targets.add(build.channel_id);
  for (const channelId of build.target_channel_ids ?? []) targets.add(channelId);
  return [...targets];
}
