import { describe, expect, it } from "vite-plus/test";
import { build, catalog, channel } from "@/shared/testing/fixtures";
import { LAYOUT, buildCanvasGraph } from "./layout";
import { WIRE, assignWires, wirePath, wireRoute, type Point } from "./wires";

const channels = [
  channel({ id: "dev", name: "dev", environment: "dev" }),
  channel({ id: "dev-qa", name: "dev-qa", environment: "dev" }),
  channel({ id: "staging", name: "staging", environment: "staging" }),
  channel({ id: "prod", name: "prod", environment: "prod" }),
  channel({ id: "prod-eu", name: "prod-eu", environment: "prod" }),
  channel({ id: "acme", name: "prod-acme", kind: "client", base_channel_id: "prod" }),
  channel({ id: "beta", name: "dev-beta", kind: "client", base_channel_id: "dev" }),
];
const builds = [
  build({ id: "b1", channel_id: "prod" }),
  build({ id: "b2", channel_id: "dev" }),
  build({ id: "b3", kind: "pipeline", channel_id: null, target_channel_ids: ["staging", "prod"] }),
  build({ id: "b4", channel_id: "dev-qa" }),
  build({ id: "b5", channel_id: "prod-eu" }),
];

const graph = buildCanvasGraph({ catalog: catalog({ channels }), stats: new Map(), builds });
const cards = graph.nodes
  .filter((node) => node.type !== "lane")
  .map((node) => {
    const isBuild = node.type === "build";
    return {
      id: node.id,
      x: node.position.x,
      y: node.position.y,
      width: isBuild ? LAYOUT.buildWidth : LAYOUT.channelWidth,
      height: isBuild ? LAYOUT.buildHeight : LAYOUT.channelHeight,
    };
  });
const card = (id: string) => cards.find((entry) => entry.id === id)!;
const routes = graph.edges.map((edge) => {
  const source = card(edge.source);
  const target = card(edge.target);
  return {
    id: edge.id,
    points: wireRoute(
      {
        sourceX: source.x + source.width,
        sourceY: source.y + source.height / 2,
        targetX: target.x,
        targetY: target.y + target.height / 2,
      },
      edge.data!,
    ),
  };
});
const segments = routes.flatMap((route) =>
  route.points.slice(1).map((point, index) => ({
    wire: route.id,
    from: route.points[index]!,
    to: point,
    first: index === 0,
    last: index === route.points.length - 2,
  })),
);

const span = (a: number, b: number) => [Math.min(a, b), Math.max(a, b)] as const;
const overlaps = (a: readonly [number, number], b: readonly [number, number]) =>
  Math.min(a[1], b[1]) - Math.max(a[0], b[0]) > 0.5;

describe("canvas wiring", () => {
  it("draws only horizontal and vertical segments", () => {
    expect(segments.length).toBeGreaterThan(graph.edges.length);
    for (const segment of segments) {
      const straight = segment.from[0] === segment.to[0] || segment.from[1] === segment.to[1];
      expect({ wire: segment.wire, straight }).toEqual({ wire: segment.wire, straight: true });
    }
  });

  it("never lays two wires on the same stretch of line", () => {
    const shared: string[] = [];
    for (let i = 0; i < segments.length; i += 1) {
      for (let j = i + 1; j < segments.length; j += 1) {
        const a = segments[i]!;
        const b = segments[j]!;
        if (a.wire === b.wire) continue;
        const vertical = (s: typeof a) => s.from[0] === s.to[0];
        if (vertical(a) && vertical(b) && a.from[0] === b.from[0]) {
          if (overlaps(span(a.from[1], a.to[1]), span(b.from[1], b.to[1])))
            shared.push(`${a.wire} | ${b.wire}`);
        } else if (!vertical(a) && !vertical(b) && a.from[1] === b.from[1]) {
          if (overlaps(span(a.from[0], a.to[0]), span(b.from[0], b.to[0])))
            shared.push(`${a.wire} | ${b.wire}`);
        }
      }
    }
    expect(shared).toEqual([]);
  });

  it("never runs through a card", () => {
    const through: string[] = [];
    for (const segment of segments) {
      for (const box of cards) {
        const [x0, x1] = span(segment.from[0], segment.to[0]);
        const [y0, y1] = span(segment.from[1], segment.to[1]);
        const inside =
          x1 > box.x + 1 &&
          x0 < box.x + box.width - 1 &&
          y1 > box.y + 1 &&
          y0 < box.y + box.height - 1;
        if (inside) through.push(`${segment.wire} through ${box.id}`);
      }
    }
    expect(through).toEqual([]);
  });

  it("lands links on one card side by side, and gives each skipping link its own track above", () => {
    const into = graph.edges.filter((edge) => edge.target === "channel:prod");
    const ports = into.map((edge) => edge.data!.targetPort);
    expect(new Set(ports).size).toBe(ports.length);
    const buses = graph.edges.flatMap((edge) => (edge.data?.busY == null ? [] : [edge.data.busY]));
    expect(buses.length).toBeGreaterThan(0);
    expect(new Set(buses).size).toBe(buses.length);
    expect(Math.min(...buses)).toBe(WIRE.busTop);
  });

  it("routes neighbouring lanes with one turn, and rounds every corner", () => {
    const { wires } = assignWires([{ id: "w", source: "a", target: "b" }], (id) =>
      id === "a" ? { lane: 0, y: 0 } : { lane: 1, y: 100 },
    );
    const wire = wires.get("w")!;
    expect(wire.busY).toBeNull();
    const route: Point[] = wireRoute({ sourceX: 0, sourceY: 0, targetX: 100, targetY: 80 }, wire);
    expect(route).toEqual([
      [0, 0],
      [WIRE.inset, 0],
      [WIRE.inset, 80],
      [100, 80],
    ]);
    expect(wirePath({ sourceX: 0, sourceY: 0, targetX: 100, targetY: 80 }, wire).path).toContain(
      "Q",
    );
    expect(wireRoute({ sourceX: 0, sourceY: 40, targetX: 100, targetY: 40 }, wire)).toEqual([
      [0, 40],
      [100, 40],
    ]);
  });
});
