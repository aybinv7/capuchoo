import { describe, expect, it } from "vite-plus/test";
import { queryKeys } from "../api/query-keys";
import { APP, build, buildDetail, bundle, catalog, channel } from "../testing/fixtures";
import type { Build, BuildDetail } from "../types/build";
import type { ChannelDetail, ReleaseCatalog } from "../types/release";
import { reduceStreamEvent, type CacheOp } from "./stream-reducer";

/** A minimal stand-in for the query cache: updates apply to what is cached, invalidations are recorded. */
function applyAll(cache: Map<string, unknown>, ops: CacheOp[]) {
  const invalidated: { key: string; throttle: boolean }[] = [];
  for (const op of ops) {
    const id = JSON.stringify(op.key);
    if (op.op === "update") {
      const next = op.update(cache.get(id));
      if (next !== undefined) cache.set(id, next);
    } else {
      invalidated.push({ key: id, throttle: op.throttle });
    }
  }
  return invalidated;
}

const key = (value: readonly unknown[]) => JSON.stringify(value);

describe("reduceStreamEvent: channel", () => {
  const rawRow = {
    id: "ch-prod",
    app_id: APP,
    name: "prod",
    environment: "prod",
    kind: "release",
    base_channel_id: null,
    is_public: true,
    allow_device_self_set: false,
    allow_dev: false,
    allow_emulator: false,
    ios_enabled: true,
    android_enabled: true,
    paused: true,
    allow_downgrade: false,
    current_bundle_id: "b-2",
    current_native_id: null,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-02T00:00:00.000Z",
  };

  it("replaces the channel in the catalog, normalising the stored row", () => {
    const cache = new Map<string, unknown>([
      [
        key(queryKeys.catalog(APP)),
        catalog({ channels: [channel({ name: "prod" }), channel({ id: "ch-dev", name: "dev" })] }),
      ],
    ]);
    applyAll(cache, reduceStreamEvent(APP, { type: "channel", data: rawRow }));
    const next = cache.get(key(queryKeys.catalog(APP))) as ReleaseCatalog;
    const prod = next.channels.find((entry) => entry.id === "ch-prod");
    expect(prod?.paused).toBe(true);
    expect(prod?.public).toBe(true);
    expect(prod?.current_bundle_id).toBe("b-2");
    expect(next.channels.map((entry) => entry.name)).toEqual(["dev", "prod"]);
  });

  it("appends a channel created elsewhere", () => {
    const cache = new Map<string, unknown>([
      [key(queryKeys.catalog(APP)), catalog({ channels: [] })],
    ]);
    applyAll(cache, reduceStreamEvent(APP, { type: "channel", data: rawRow }));
    expect((cache.get(key(queryKeys.catalog(APP))) as ReleaseCatalog).channels).toHaveLength(1);
  });

  it("merges into a cached detail, keeping health, and refetches detail, history and stats", () => {
    const detail: ChannelDetail = {
      ...channel(),
      current_bundle: bundle(),
      current_native: null,
      health: null,
    };
    const cache = new Map<string, unknown>([[key(queryKeys.channel("ch-prod")), detail]]);
    const invalidated = applyAll(cache, reduceStreamEvent(APP, { type: "channel", data: rawRow }));
    expect((cache.get(key(queryKeys.channel("ch-prod"))) as ChannelDetail).paused).toBe(true);
    expect(invalidated).toEqual(
      expect.arrayContaining([
        { key: key(queryKeys.channelHistory("ch-prod")), throttle: false },
        { key: key(queryKeys.statsAll(APP)), throttle: true },
      ]),
    );
  });

  it("ignores rows of another app and malformed payloads", () => {
    expect(
      reduceStreamEvent(APP, { type: "channel", data: { ...rawRow, app_id: "other" } }),
    ).toEqual([]);
    expect(reduceStreamEvent(APP, { type: "channel", data: { id: "x" } })).toEqual([]);
    expect(reduceStreamEvent(APP, { type: "channel", data: null })).toEqual([]);
  });

  it("leaves uncached queries alone", () => {
    const cache = new Map<string, unknown>();
    applyAll(cache, reduceStreamEvent(APP, { type: "channel", data: rawRow }));
    expect(cache.size).toBe(0);
  });
});

describe("reduceStreamEvent: builds", () => {
  it("prepends a new build and updates an existing one in place", () => {
    const older = build({ id: "old", created_at: "2026-09-01T00:00:00.000Z", status: "succeeded" });
    const cache = new Map<string, unknown>([[key(queryKeys.builds(APP)), [older]]]);
    applyAll(
      cache,
      reduceStreamEvent(APP, {
        type: "build",
        data: build({ id: "new", created_at: "2026-09-03T00:00:00.000Z" }),
      }),
    );
    applyAll(
      cache,
      reduceStreamEvent(APP, { type: "build", data: { ...older, status: "failed" } }),
    );
    const builds = cache.get(key(queryKeys.builds(APP))) as Build[];
    expect(builds.map((entry) => entry.id)).toEqual(["new", "old"]);
    expect(builds[1]?.status).toBe("failed");
  });

  it("keeps the actor email the list query joined in", () => {
    const listed = { ...build({ id: "b" }), actor_email: "ci@example.com" };
    const cache = new Map<string, unknown>([[key(queryKeys.builds(APP)), [listed]]]);
    applyAll(
      cache,
      reduceStreamEvent(APP, { type: "build", data: build({ id: "b", status: "succeeded" }) }),
    );
    expect((cache.get(key(queryKeys.builds(APP))) as Build[])[0]?.actor_email).toBe(
      "ci@example.com",
    );
  });

  it("updates a cached build detail without losing its events", () => {
    const event = {
      id: "1",
      build_id: "build-1",
      step: "upload",
      status: "running" as const,
      message: null,
      created_at: "2026-09-01T00:00:01.000Z",
    };
    const cache = new Map<string, unknown>([
      [key(queryKeys.build("build-1")), buildDetail({ events: [event] })],
    ]);
    applyAll(
      cache,
      reduceStreamEvent(APP, { type: "build", data: build({ status: "succeeded" }) }),
    );
    const detail = cache.get(key(queryKeys.build("build-1"))) as BuildDetail;
    expect(detail.status).toBe("succeeded");
    expect(detail.events).toHaveLength(1);
  });

  it("appends step events in id order and ignores a redelivered one", () => {
    const cache = new Map<string, unknown>([[key(queryKeys.build("build-1")), buildDetail()]]);
    const step = (id: number, name: string) => ({
      id,
      build_id: "build-1",
      step: name,
      status: "running",
      message: null,
      created_at: "2026-09-01T00:00:00.000Z",
    });
    applyAll(cache, reduceStreamEvent(APP, { type: "build_event", data: step(11, "upload") }));
    applyAll(cache, reduceStreamEvent(APP, { type: "build_event", data: step(9, "bundle") }));
    applyAll(cache, reduceStreamEvent(APP, { type: "build_event", data: step(11, "upload") }));
    const detail = cache.get(key(queryKeys.build("build-1"))) as BuildDetail;
    expect(detail.events.map((event) => event.step)).toEqual(["bundle", "upload"]);
    expect(detail.events[0]?.id).toBe("9");
  });
});

describe("reduceStreamEvent: other events", () => {
  it("refetches the catalog when an artefact is uploaded", () => {
    expect(
      reduceStreamEvent(APP, {
        type: "artefact",
        data: { kind: "ota", id: "b", version: "1.2.0" },
      }),
    ).toEqual([{ op: "invalidate", key: queryKeys.catalog(APP), throttle: false }]);
  });

  it("throttles device telemetry into devices and stats refetches", () => {
    const ops = reduceStreamEvent(APP, {
      type: "device",
      data: { event: "set", status: "delivered" },
    });
    expect(ops).toEqual([
      { op: "invalidate", key: queryKeys.devicesAll(APP), throttle: true },
      { op: "invalidate", key: queryKeys.statsAll(APP), throttle: true },
    ]);
  });

  it("does nothing for heartbeats and unknown events", () => {
    expect(reduceStreamEvent(APP, { type: "ping", data: {} })).toEqual([]);
    expect(reduceStreamEvent(APP, { type: "ready", data: { app_id: APP } })).toEqual([]);
    expect(reduceStreamEvent(APP, { type: "mystery", data: {} })).toEqual([]);
  });
});
