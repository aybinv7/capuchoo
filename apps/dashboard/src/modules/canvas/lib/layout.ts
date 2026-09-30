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
    if (build.channel_id && channelIds.has(build.channel_id)) {
      const running = build.status === "running" || build.status === "queued";
      edges.push({
        id: `build:${build.id}:${build.channel_id}`,
        source: `build:${build.id}`,
        target: `channel:${build.channel_id}`,
        type: "default",
        animated: running,
        class: running
          ? "edge-build-live"
          : build.status === "failed"
            ? "edge-build-failed"
            : "edge-build",
      });
    }
  });

  return { nodes, edges };
}

interface Placed {
  id: string;
  type?: string;
  position: { x: number; y: number };
}

const estimatedHeight = (node: Placed) =>
  node.type === "build" ? LAYOUT.buildHeight : LAYOUT.channelHeight;

/**
 * Re-stacks every column with the heights the canvas measured, keeping each column's order. The
 * layout above estimates heights; a running build that lists its steps, or a channel with badges,
 * renders taller, and stacking by the estimate would overlap them.
 */
export function stackColumns<T extends Placed>(
  nodes: readonly T[],
  heights: ReadonlyMap<string, number>,
): T[] {
  const columns = new Map<number, T[]>();
  for (const node of nodes) {
    if (node.type === "lane") continue;
    const column = columns.get(node.position.x);
    if (column) column.push(node);
    else columns.set(node.position.x, [node]);
  }
  const placed = new Map<string, number>();
  for (const column of columns.values()) {
    column.sort((a, b) => a.position.y - b.position.y);
    let cursor = LAYOUT.contentTop;
    for (const node of column) {
      placed.set(node.id, cursor);
      cursor += (heights.get(node.id) ?? estimatedHeight(node)) + LAYOUT.rowGap;
    }
  }
  return nodes.map((node) => {
    const y = placed.get(node.id);
    return y === undefined || y === node.position.y
      ? node
      : { ...node, position: { x: node.position.x, y } };
  });
}
