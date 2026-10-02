import { describe, expect, it } from "vite-plus/test";
import { queryKeys } from "../api/query-keys";
import { APP, build, buildDetail, buildJob, bundle, catalog, channel } from "../testing/fixtures";
import type { Build, BuildDetail } from "../types/build";
import type { ChannelDetail, ReleaseCatalog } from "../types/release";
import { normalizeBuildDetail, normalizeBuildJob } from "./normalize";
import { mergeJob, reduceStreamEvent, type CacheOp } from "./stream-reducer";

/** A minimal stand-in for the query cache: updates apply to what is cached, invalidations are recorded. */
function applyAll(cache: Map<string, unknown>, ops: CacheOp[]) {
  const invalidated: { key: string; throttle: boolean }[] = [];
  for (const op of ops) {
    if (op.op === "updateMatching") {
      const prefix = JSON.stringify(op.prefix).slice(0, -1);
      for (const [id, value] of cache) {
        if (!id.startsWith(prefix)) continue;
        const next = op.update(value);
        if (next !== undefined) cache.set(id, next);
      }
      continue;
    }
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

describe("reduceStreamEvent: pipeline jobs", () => {
  const detailKey = key(queryKeys.build("build-1"));
  const send = (cache: Map<string, unknown>, data: unknown) =>
    applyAll(cache, reduceStreamEvent(APP, { type: "build_job", data }));
  const jobs = (cache: Map<string, unknown>) => (cache.get(detailKey) as BuildDetail).jobs;

  it("upserts a job into its run by id", () => {
    const cache = new Map<string, unknown>([[detailKey, buildDetail({ kind: "pipeline" })]]);
    send(cache, buildJob({ id: "j1", status: "queued" }));
    send(cache, buildJob({ id: "j2", name: "publish" }));
    send(cache, buildJob({ id: "j1", status: "running" }));
    expect(jobs(cache).map((job) => [job.id, job.status])).toEqual([
      ["j1", "running"],
      ["j2", "queued"],
    ]);
  });

  it("never lets a late event move a job backwards", () => {
    const cache = new Map<string, unknown>([
      [detailKey, buildDetail({ jobs: [buildJob({ id: "j1", status: "succeeded" })] })],
    ]);
    const before = cache.get(detailKey);
    send(cache, buildJob({ id: "j1", status: "running" }));
    expect(jobs(cache)[0]?.status).toBe("succeeded");
    expect(cache.get(detailKey)).toBe(before);
  });

  it("lets a later attempt replace a finished job, and ignores an older one", () => {
    const cache = new Map<string, unknown>([
      [detailKey, buildDetail({ jobs: [buildJob({ id: "j1", status: "failed", attempt: 1 })] })],
    ]);
    send(cache, buildJob({ id: "j1", status: "queued", attempt: 2 }));
    expect(jobs(cache)[0]).toMatchObject({ status: "queued", attempt: 2 });
    send(cache, buildJob({ id: "j1", status: "failed", attempt: 1 }));
    expect(jobs(cache)[0]).toMatchObject({ status: "queued", attempt: 2 });
  });

  it("keeps the newer terminal report, which is how a re-run replaces a failure", () => {
    const current = buildJob({ status: "failed" });
    expect(mergeJob(current, buildJob({ status: "succeeded" })).status).toBe("succeeded");
  });

  it("drops a job without ids and leaves an uncached run alone", () => {
    expect(reduceStreamEvent(APP, { type: "build_job", data: { name: "x" } })).toEqual([]);
    const cache = new Map<string, unknown>();
    send(cache, buildJob());
    expect(cache.size).toBe(0);
  });

  it("normalises steps and unknown statuses", () => {
    const job = normalizeBuildJob({
      id: "j",
      build_id: "b",
      name: "build",
      status: "in_progress",
      steps: [
        { number: 2, name: "Test", status: "running" },
        { number: 1, name: "Checkout", status: "succeeded" },
        { name: "" },
      ],
    });
    expect(job?.status).toBe("pending");
    expect(job?.steps.map((step) => step.name)).toEqual(["Checkout", "Test"]);
    expect(job?.attempt).toBe(1);
  });
});

describe("reduceStreamEvent: child builds", () => {
  const child = build({
    id: "deploy-1",
    parent_id: "run-1",
    job_key: "publish",
    created_at: "2026-09-01T00:01:00.000Z",
  });

  it("files a CLI deploy under its run, not in the top-level list", () => {
    const run = build({ id: "run-1", kind: "pipeline" });
    const cache = new Map<string, unknown>([
      [key(queryKeys.builds(APP)), [run]],
      [key(queryKeys.build("run-1")), buildDetail({ id: "run-1", kind: "pipeline" })],
    ]);
    applyAll(cache, reduceStreamEvent(APP, { type: "build", data: child }));
    applyAll(
      cache,
      reduceStreamEvent(APP, { type: "build", data: { ...child, status: "succeeded" } }),
    );
    expect((cache.get(key(queryKeys.builds(APP))) as Build[]).map((entry) => entry.id)).toEqual([
      "run-1",
    ]);
    const parent = cache.get(key(queryKeys.build("run-1"))) as BuildDetail;
    expect(parent.children).toHaveLength(1);
    expect(parent.children[0]?.status).toBe("succeeded");
  });

  it("adds a deploy's channel to its run's targets once", () => {
    const run = build({ id: "run-1", kind: "pipeline", target_channel_ids: ["ch-dev"] });
    const cache = new Map<string, unknown>([[key(queryKeys.builds(APP)), [run]]]);
    const deploy = { ...child, channel_id: "ch-prod" };
    applyAll(cache, reduceStreamEvent(APP, { type: "build", data: deploy }));
    applyAll(cache, reduceStreamEvent(APP, { type: "build", data: deploy }));
    const [entry] = cache.get(key(queryKeys.builds(APP))) as Build[];
    expect(entry?.target_channel_ids).toEqual(["ch-dev", "ch-prod"]);
  });

  it("keeps a run's targets when a stream row leaves them out", () => {
    const run = build({ id: "run-1", kind: "pipeline", target_channel_ids: ["ch-prod"] });
    const cache = new Map<string, unknown>([[key(queryKeys.builds(APP)), [run]]]);
    const { target_channel_ids: _targets, ...row } = { ...run, status: "succeeded" as const };
    applyAll(cache, reduceStreamEvent(APP, { type: "build", data: row }));
    const [entry] = cache.get(key(queryKeys.builds(APP))) as Build[];
    expect(entry?.status).toBe("succeeded");
    expect(entry?.target_channel_ids).toEqual(["ch-prod"]);
  });

  it("keeps a run's jobs, children and plan when its row changes", () => {
    const plan = {
      provider: "github" as const,
      source: null,
      stages: [],
      jobs: [{ key: "a", name: "a", needs: [], stage: null, gated: false, condition: null }],
    };
    const cache = new Map<string, unknown>([
      [
        key(queryKeys.build("run-1")),
        buildDetail({
          id: "run-1",
          jobs: [buildJob()],
          children: [{ ...child, events: [] }],
          plan,
        }),
      ],
    ]);
    applyAll(
      cache,
      reduceStreamEvent(APP, {
        type: "build",
        data: { ...build({ id: "run-1", status: "failed" }), plan: "not a plan", jobs: [] },
      }),
    );
    const detail = cache.get(key(queryKeys.build("run-1"))) as BuildDetail;
    expect(detail.status).toBe("failed");
    expect(detail.jobs).toHaveLength(1);
    expect(detail.children).toHaveLength(1);
    expect(detail.plan).toEqual(plan);
  });

  it("takes the plan when a build event carries one", () => {
    const plan = {
      provider: "github",
      source: ".github/workflows/capuchoo.yml",
      stages: [],
      jobs: [{ key: "plan", name: "plan", needs: [], stage: null, gated: false, condition: null }],
    };
    const cache = new Map<string, unknown>([
      [key(queryKeys.build("run-1")), buildDetail({ id: "run-1" })],
    ]);
    applyAll(
      cache,
      reduceStreamEvent(APP, { type: "build", data: { ...build({ id: "run-1" }), plan } }),
    );
    expect((cache.get(key(queryKeys.build("run-1"))) as BuildDetail).plan?.jobs).toHaveLength(1);
  });

  it("appends a deploy's step events to the run that holds it", () => {
    const cache = new Map<string, unknown>([
      [
        key(queryKeys.build("run-1")),
        buildDetail({ id: "run-1", children: [{ ...child, events: [] }] }),
      ],
      [key(queryKeys.build("other")), buildDetail({ id: "other" })],
    ]);
    const other = cache.get(key(queryKeys.build("other")));
    const step = {
      id: 5,
      build_id: "deploy-1",
      step: "upload",
      status: "running",
      message: null,
      created_at: "2026-09-01T00:01:05.000Z",
    };
    applyAll(cache, reduceStreamEvent(APP, { type: "build_event", data: step }));
    applyAll(cache, reduceStreamEvent(APP, { type: "build_event", data: step }));
    const parent = cache.get(key(queryKeys.build("run-1"))) as BuildDetail;
    expect(parent.children[0]?.events.map((event) => event.step)).toEqual(["upload"]);
    expect(cache.get(key(queryKeys.build("other")))).toBe(other);
  });

  it("keeps a deploy's events when its row changes", () => {
    const event = {
      id: "1",
      build_id: "deploy-1",
      step: "web",
      status: "succeeded" as const,
      message: null,
      created_at: "2026-09-01T00:01:01.000Z",
    };
    const cache = new Map<string, unknown>([
      [
        key(queryKeys.build("run-1")),
        buildDetail({ id: "run-1", children: [{ ...child, events: [event] }] }),
      ],
    ]);
    applyAll(
      cache,
      reduceStreamEvent(APP, { type: "build", data: { ...child, status: "failed" } }),
    );
    const parent = cache.get(key(queryKeys.build("run-1"))) as BuildDetail;
    expect(parent.children[0]).toMatchObject({ status: "failed", events: [event] });
  });

  it("reads a detail from a server without CI fields", () => {
    const detail = normalizeBuildDetail({ ...build(), events: [] });
    expect(detail).toMatchObject({ jobs: [], children: [], plan: null, parent_id: null });
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
      { op: "invalidate", key: queryKeys.activityAll(APP), throttle: true },
    ]);
  });

  it("also refetches the reporting device's own page, throttled", () => {
    const ops = reduceStreamEvent(APP, {
      type: "device",
      data: { device_uuid: "dev-1", event: "get", status: null },
    });
    expect(ops).toContainEqual({
      op: "invalidate",
      key: queryKeys.device(APP, "dev-1"),
      throttle: true,
    });
    expect(
      reduceStreamEvent(APP, { type: "device", data: { device_uuid: "" } }).some(
        (op) => op.op === "invalidate" && op.key[2] === "device",
      ),
    ).toBe(false);
  });

  it("does nothing for heartbeats and unknown events", () => {
    expect(reduceStreamEvent(APP, { type: "ping", data: {} })).toEqual([]);
    expect(reduceStreamEvent(APP, { type: "ready", data: { app_id: APP } })).toEqual([]);
    expect(reduceStreamEvent(APP, { type: "mystery", data: {} })).toEqual([]);
  });
});
