import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { createTestContext, seedApp, type TestContext } from "./harness";

let ctx: TestContext;
let owner: { id: string; token: string };
let appId: string;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

beforeEach(async () => {
  ctx = await createTestContext();
  owner = await ctx.user("owner@acme.test");
  appId = (await seedApp(ctx, owner.token)).app.id;
});
afterEach(async () => {
  await ctx.close();
});

async function session(input: {
  ago: number;
  device?: string;
  version?: string;
  start?: string;
  errors?: number;
  bytes?: number;
  minutes?: number;
  note?: string | null;
  segments?: number;
  live?: boolean;
}) {
  const now = ctx.deps.now().getTime();
  const startedAt = new Date(now - input.ago);
  const endedAt = new Date(startedAt.getTime() + (input.minutes ?? 2) * 60_000);
  const row = await ctx.db
    .insertInto("recording_sessions")
    .values({
      app_id: appId,
      session_key: randomUUID(),
      device_id: input.device ?? "tablet-1",
      platform: "android",
      version_name: input.version ?? "3.0.0",
      start: input.start ?? "policy",
      mode: "session",
      note: input.note ?? null,
      started_at: startedAt,
      ended_at: input.live ? new Date(now) : endedAt,
      last_segment_at: input.live ? new Date(now - 2000) : endedAt,
      segment_count: input.segments ?? 3,
      size_bytes: input.bytes ?? 1000,
      error_count: input.errors ?? 0,
      finished: !input.live,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  return row.id;
}

async function stats(days = 30) {
  const response = await ctx.request(`/api/apps/${appId}/recording-stats?days=${days}`, {
    token: owner.token,
  });
  expect(response.status).toBe(200);
  return response.json();
}

describe("recording statistics", () => {
  it("counts the window's stored sessions, their errors, bytes and time", async () => {
    await session({ ago: 2 * HOUR, errors: 2, bytes: 4000, minutes: 4, start: "error" });
    await session({ ago: DAY + HOUR, device: "tablet-2", bytes: 1000, minutes: 2 });
    await session({ ago: 3 * DAY, note: "order stuck", start: "shake", bytes: 2000, minutes: 6 });
    await session({ ago: HOUR, segments: 0 });
    await session({ ago: 40 * DAY });

    const body = await stats(30);
    expect(body.totals).toEqual({
      sessions: 3,
      error_sessions: 1,
      reports: 1,
      devices: 2,
      bytes: 7000,
      duration_ms: 12 * 60_000,
      live_now: 0,
      error_rate: 1 / 3,
      avg_duration_ms: 4 * 60_000,
    });
    expect(
      body.daily
        .map((day: { sessions: number }) => day.sessions)
        .reduce((a: number, b: number) => a + b),
    ).toBe(3);
    expect(body.starts).toEqual(
      expect.arrayContaining([
        { start: "error", sessions: 1 },
        { start: "shake", sessions: 1 },
        { start: "policy", sessions: 1 },
      ]),
    );
  });

  it("tells each version's error sessions apart, highest version first", async () => {
    await session({ ago: 5 * DAY, version: "3.0.0" });
    await session({ ago: 4 * DAY, version: "3.0.0", errors: 1 });
    await session({ ago: HOUR, version: "3.1.0", errors: 3 });

    const body = await stats();
    expect(body.versions.map((row: { version: string }) => row.version)).toEqual([
      "3.1.0",
      "3.0.0",
    ]);
    expect(body.versions[1]).toMatchObject({ sessions: 2, error_sessions: 1, devices: 1 });
  });

  it("ranks the window's unresolved errors and counts open, regressed and new", async () => {
    const now = ctx.deps.now();
    const first = await session({ ago: HOUR, errors: 1 });
    const second = await session({ ago: 2 * HOUR, errors: 1, device: "tablet-2" });
    const issues = await ctx.db
      .insertInto("recording_issues")
      .values([
        {
          app_id: appId,
          fingerprint: "a",
          message: "TypeError: order is undefined",
          occurrences: 5,
          first_version: "3.0.0",
          last_version: "3.0.0",
          first_seen: new Date(now.getTime() - 60 * DAY),
          last_seen: now,
          status: "regressed",
        },
        {
          app_id: appId,
          fingerprint: "b",
          message: "Network request failed",
          occurrences: 1,
          first_version: "3.0.0",
          last_version: "3.0.0",
          first_seen: now,
          last_seen: now,
        },
        {
          app_id: appId,
          fingerprint: "c",
          message: "Fixed long ago",
          occurrences: 9,
          first_version: "2.0.0",
          last_version: "2.0.0",
          first_seen: now,
          last_seen: now,
          status: "resolved",
        },
      ])
      .returning("id")
      .execute();
    const [regressed, fresh, resolved] = issues.map((row) => row.id);
    await ctx.db
      .insertInto("recording_issue_sessions")
      .values([
        {
          issue_id: regressed!,
          session_id: first,
          device_id: "tablet-1",
          version_name: "3.0.0",
          first_at: now,
          occurrences: 3,
        },
        {
          issue_id: regressed!,
          session_id: second,
          device_id: "tablet-2",
          version_name: "3.0.0",
          first_at: now,
          occurrences: 2,
        },
        {
          issue_id: fresh!,
          session_id: first,
          device_id: "tablet-1",
          version_name: "3.0.0",
          first_at: now,
          occurrences: 1,
        },
        {
          issue_id: resolved!,
          session_id: first,
          device_id: "tablet-1",
          version_name: "3.0.0",
          first_at: now,
          occurrences: 9,
        },
      ])
      .execute();

    const body = await stats();
    expect(body.issues).toMatchObject({ open: 1, regressed: 1, new: 2 });
    expect(body.issues.top.map((issue: { message: string }) => issue.message)).toEqual([
      "TypeError: order is undefined",
      "Network request failed",
    ]);
    expect(body.issues.top[0]).toMatchObject({
      sessions: 2,
      devices: 2,
      occurrences: 5,
      status: "regressed",
    });
  });

  it("knows what is live and which recorders are online or in trouble", async () => {
    const now = ctx.deps.now();
    await session({ ago: 60_000, live: true });
    await ctx.db
      .insertInto("recorder_health")
      .values([
        {
          app_id: appId,
          device_id: "tablet-1",
          platform: "android",
          version_name: "3.0.0",
          health: JSON.stringify({ lastError: null, droppedSegments: 0 }),
          seen_at: now,
        },
        {
          app_id: appId,
          device_id: "tablet-2",
          platform: "android",
          version_name: "3.0.0",
          health: JSON.stringify({ lastError: "quota", droppedSegments: 4 }),
          seen_at: now,
        },
        {
          app_id: appId,
          device_id: "tablet-3",
          platform: "android",
          version_name: "3.0.0",
          health: JSON.stringify({ lastError: null, droppedSegments: 0 }),
          seen_at: new Date(now.getTime() - DAY),
        },
      ])
      .execute();
    await ctx.db
      .insertInto("recording_rules")
      .values({
        app_id: appId,
        scope: "app",
        policy: JSON.stringify({}),
        live_until: new Date(now.getTime() + 600_000),
      })
      .execute();

    const body = await stats();
    expect(body.totals.live_now).toBe(1);
    expect(body.recorders).toEqual({ total: 3, online: 2, degraded: 1, live_rules: 1 });
  });

  it("answers an empty app with zeros, not nulls in the counts", async () => {
    const body = await stats(7);
    expect(body.totals).toMatchObject({ sessions: 0, error_rate: null, avg_duration_ms: null });
    expect(body.daily).toEqual([]);
    expect(body.issues).toEqual({ open: 0, regressed: 0, new: 0, top: [] });
  });

  it("is refused to someone outside the app", async () => {
    const stranger = await ctx.user("stranger@else.test");
    const response = await ctx.request(`/api/apps/${appId}/recording-stats`, {
      token: stranger.token,
    });
    expect([403, 404]).toContain(response.status);
  });
});
