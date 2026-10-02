import { describe, expect, it } from "vite-plus/test";
import { build, bundle, catalog, channel } from "@/shared/testing/fixtures";
import type { ChannelStats } from "@/shared/types/stats";
import type { ChannelNodeData } from "../types/canvas.types";
import { buildCanvasGraph } from "./layout";

const dev = channel({ id: "dev", name: "dev", environment: "dev" });
const staging = channel({ id: "staging", name: "staging", environment: "staging" });
const prod = channel({ id: "prod", name: "prod", environment: "prod", current_bundle_id: "b-1" });
const acme = channel({ id: "acme", name: "prod-acme", kind: "client", base_channel_id: "prod" });

const stats = new Map<string, ChannelStats>([
  [
    "prod",
    {
      channel_id: "prod",
      name: "prod",
      devices: 10,
      active_24h: 4,
      on_current: 8,
      installs_24h: 3,
      failures_24h: 1,
      installs_7d: 9,
      failures_7d: 1,
    },
  ],
]);

describe("buildCanvasGraph", () => {
  const graph = buildCanvasGraph({
    catalog: catalog({ channels: [acme, prod, dev, staging], bundles: [bundle({ id: "b-1" })] }),
    stats,
    builds: [
      build({ id: "b1", channel_id: "prod", status: "running" }),
      build({ id: "b2", channel_id: "gone" }),
    ],
  });
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));

  it("places release channels left to right in promotion order, clients last", () => {
    const x = (id: string) => byId.get(id)?.position.x ?? Number.NaN;
    expect(x("build:b1")).toBeLessThan(x("channel:dev"));
    expect(x("channel:dev")).toBeLessThan(x("channel:staging"));
    expect(x("channel:staging")).toBeLessThan(x("channel:prod"));
    expect(x("channel:prod")).toBeLessThan(x("channel:acme"));
  });

  it("carries current artefacts and health into channel nodes", () => {
    const data = byId.get("channel:prod")?.data as ChannelNodeData;
    expect(data.bundle?.id).toBe("b-1");
    expect(data.stats?.devices).toBe(10);
    expect((byId.get("channel:dev")?.data as ChannelNodeData | undefined)?.stats).toBeNull();
  });

  it("links promotion, client-to-base and build-to-channel", () => {
    const edges = graph.edges.map((edge) => edge.id);
    expect(edges).toContain("promote:dev:staging");
    expect(edges).toContain("promote:staging:prod");
    expect(edges).toContain("follows:prod:acme");
    expect(edges).toContain("build:b1:prod");
    expect(graph.edges.find((edge) => edge.id === "build:b1:prod")?.animated).toBe(true);
    expect(edges.some((edge) => edge.includes("gone"))).toBe(false);
  });

  it("links a pipeline run to every channel its deploys published to, once each", () => {
    const run = (overrides: Parameters<typeof build>[0]) =>
      buildCanvasGraph({
        catalog: catalog({ channels: [dev, staging, prod] }),
        stats,
        builds: [build({ id: "run", kind: "pipeline", channel_id: null, ...overrides })],
      }).edges.filter((edge) => edge.source === "build:run");

    const live = run({ status: "running", target_channel_ids: ["staging", "prod", "staging"] });
    expect(live.map((edge) => edge.id)).toEqual(["build:run:staging", "build:run:prod"]);
    expect(live.every((edge) => edge.animated && edge.class === "edge-build-live")).toBe(true);

    const failed = run({
      status: "failed",
      channel_id: "prod",
      target_channel_ids: ["prod", "gone"],
    });
    expect(failed.map((edge) => [edge.id, edge.class])).toEqual([
      ["build:run:prod", "edge-build-failed"],
    ]);

    expect(run({ status: "succeeded", target_channel_ids: [] })).toEqual([]);
    expect(run({ status: "succeeded" })).toEqual([]);
  });

  it("is deterministic and draws only lanes that have channels", () => {
    const again = buildCanvasGraph({
      catalog: catalog({ channels: [dev, staging, prod, acme], bundles: [bundle({ id: "b-1" })] }),
      stats,
      builds: [
        build({ id: "b1", channel_id: "prod", status: "running" }),
        build({ id: "b2", channel_id: "gone" }),
      ],
    });
    expect(again.nodes.map((node) => [node.id, node.position])).toEqual(
      graph.nodes.map((node) => [node.id, node.position]),
    );
    const lanes = buildCanvasGraph({ catalog: catalog({ channels: [prod] }), stats, builds: [] })
      .nodes.filter((node) => node.type === "lane")
      .map((node) => node.id);
    expect(lanes).toEqual(["lane:builds", "lane:prod"]);
  });
});
