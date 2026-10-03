import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { RECORDING_ASSET_HEADER, RECORDING_HEADER, encodeRecordingHeader } from "@capuchoo/core";
import type { HubEvent } from "../src/services/event-hub";
import { runRetention } from "../src/services/retention";
import { createTestContext, seedApp, type TestContext } from "./harness";

let ctx: TestContext;
let owner: { id: string; token: string };
let appId: string;
let channels: Record<string, { id: string; name: string }>;

const SESSION = "0190a8d2-7c1e-7b3a-9f00-1234567890ab";
const STARTED = 1_790_000_000_000;

beforeEach(async () => {
  ctx = await createTestContext();
  owner = await ctx.user("owner@acme.test");
  const seeded = await seedApp(ctx, owner.token);
  appId = seeded.app.id;
  channels = seeded.channels;
});
afterEach(async () => {
  await ctx.close();
});

function sessionMeta(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: SESSION,
    appId: "com.acme.app",
    deviceId: "tablet-1",
    platform: "android",
    versionName: "3.0.1",
    versionCode: 42,
    channel: "prod",
    start: "shake",
    mode: "session",
    startedAt: STARTED,
    recorder: "0.1.0",
    device: { model: "Pixel" },
    note: "order stuck",
    ...overrides,
  };
}

function segmentMeta(seq: number, overrides: Record<string, unknown> = {}) {
  return {
    sessionId: SESSION,
    seq,
    startedAt: STARTED + seq * 5000,
    endedAt: STARTED + seq * 5000 + 4000,
    events: 3,
    bytes: 300,
    fullSnapshot: seq === 0,
    errors: seq === 1 ? 1 : 0,
    final: false,
    ...overrides,
  };
}

const lines = (seq: number) =>
  [
    { k: "meta", t: STARTED, d: { seq } },
    { k: "console", t: STARTED + 1, d: { level: "log", text: "hello" } },
    { k: "marker", t: STARTED + 2, d: { kind: "route", url: "/orders" } },
  ]
    .map((line) => JSON.stringify(line))
    .join("\n");

function postSegment(
  seq: number,
  options: {
    session?: Record<string, unknown>;
    segment?: Record<string, unknown>;
    body?: BodyInit;
  } = {},
) {
  return ctx.request("/api/recording/segments", {
    method: "POST",
    headers: {
      "content-type": "application/octet-stream",
      [RECORDING_HEADER]: encodeRecordingHeader({
        session: sessionMeta(options.session),
        segment: segmentMeta(seq, options.segment),
      }),
    },
    body: options.body ?? gzipSync(lines(seq)),
  });
}

function askPolicy(extra: Record<string, unknown> = {}) {
  return ctx.request("/api/recording/policy", {
    method: "POST",
    json: {
      appId: "com.acme.app",
      deviceId: "tablet-1",
      platform: "android",
      versionName: "3.0.1",
      channel: "prod",
      ...extra,
    },
  });
}

function putRule(json: Record<string, unknown>) {
  return ctx.request(`/api/apps/${appId}/recording-rules`, {
    method: "PUT",
    token: owner.token,
    json,
  });
}

describe("recording policy", () => {
  it("is off by default and 404 for an unknown app", async () => {
    const response = await askPolicy();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.policy.mode).toBe("off");
    expect(body.known_assets).toEqual([]);
    expect((await askPolicy({ appId: "com.nobody" })).status).toBe(404);
  });

  it("layers app, channel and device rules, and answers unchanged for a known version", async () => {
    expect((await putRule({ scope: "app", policy: { mode: "buffer" } })).status).toBe(200);
    expect(
      (
        await putRule({
          scope: "channel",
          channel_id: channels.prod!.id,
          policy: { flushMs: 2000 },
        })
      ).status,
    ).toBe(200);

    const first = (await (await askPolicy()).json()).policy;
    expect(first).toMatchObject({ mode: "buffer", flushMs: 2000 });

    const again = await (await askPolicy({ known: first.version })).json();
    expect(again).toEqual({ unchanged: true, version: first.version });

    const devChannel = (await (await askPolicy({ channel: "dev" })).json()).policy;
    expect(devChannel.flushMs).toBe(5000);
  });

  it("goes live for a device until the deadline", async () => {
    await ctx.request("/api/update", {
      method: "POST",
      json: { app_id: "com.acme.app", device_id: "tablet-1", platform: "android" },
    });
    const devices = await (
      await ctx.request(`/api/apps/${appId}/devices`, { token: owner.token })
    ).json();
    const deviceUuid = devices.devices[0].id;

    const response = await putRule({ scope: "device", device_id: deviceUuid, live_minutes: 10 });
    expect(response.status).toBe(200);
    expect((await response.json()).rule.live_until).not.toBeNull();

    expect((await (await askPolicy()).json()).policy).toMatchObject({
      mode: "live",
      ceiling: "live",
    });

    const preview = await (
      await ctx.request(`/api/devices/${deviceUuid}/recording-policy`, { token: owner.token })
    ).json();
    expect(preview.policy.mode).toBe("live");
  });

  it("answers a held request the moment a rule changes", async () => {
    const { policy } = await (await askPolicy()).json();
    const started = Date.now();
    const held = askPolicy({ known: policy.version, wait: 20 });
    await new Promise((resolve) => setTimeout(resolve, 200));
    await putRule({ scope: "app", policy: { mode: "buffer" } });

    const answer = await (await held).json();
    expect(answer.policy.mode).toBe("buffer");
    expect(Date.now() - started).toBeLessThan(5000);
  });

  it("answers a held request unchanged when its wait runs out", async () => {
    const { policy } = await (await askPolicy()).json();
    const started = Date.now();
    const answer = await (await askPolicy({ known: policy.version, wait: 1 })).json();
    expect(answer).toEqual({ unchanged: true, version: policy.version });
    expect(Date.now() - started).toBeGreaterThanOrEqual(900);
  });

  it("refuses a channel from another app and reports dropped fields", async () => {
    const foreign = await putRule({
      scope: "channel",
      channel_id: "00000000-0000-4000-8000-000000000000",
      policy: {},
    });
    expect(foreign.status).toBe(404);

    const body = await (
      await putRule({ scope: "app", policy: { mode: "loud", flushMs: 1 } })
    ).json();
    expect(body.dropped).toEqual(["mode"]);
    expect(body.rule.policy).toEqual({ flushMs: 1000 });
  });

  it("deletes a rule", async () => {
    const { rule } = await (await putRule({ scope: "app", policy: { mode: "buffer" } })).json();
    const removed = await ctx.request(`/api/recording-rules/${rule.id}`, {
      method: "DELETE",
      token: owner.token,
    });
    expect(removed.status).toBe(204);
    expect((await (await askPolicy()).json()).policy.mode).toBe("off");
  });
});

describe("recording segments", () => {
  it("are stored once, listed, and served gzip for the browser to inflate", async () => {
    const published: HubEvent[] = [];
    ctx.deps.hub.subscribe(appId, (event) => published.push(event));

    expect((await postSegment(0)).status).toBe(201);
    expect((await postSegment(1)).status).toBe(201);
    const retry = await postSegment(1);
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual({ status: "duplicate", seq: 1 });
    expect(published.filter((event) => event.type === "recording")).toHaveLength(2);

    const list = await (
      await ctx.request(`/api/apps/${appId}/recordings`, { token: owner.token })
    ).json();
    expect(list.sessions).toHaveLength(1);
    const [session] = list.sessions;
    expect(session).toMatchObject({
      segment_count: 2,
      event_count: 6,
      error_count: 1,
      start: "shake",
      note: "order stuck",
      version_name: "3.0.1",
      duration_ms: 9000,
    });

    const detail = await (
      await ctx.request(`/api/recordings/${session.id}`, { token: owner.token })
    ).json();
    expect(detail.segments.map((segment: { seq: number }) => segment.seq)).toEqual([0, 1]);
    expect(detail.segments[0].full_snapshot).toBe(true);

    const served = await ctx.request(`/api/recordings/${session.id}/segments/1`, {
      token: owner.token,
    });
    expect(served.headers.get("content-encoding")).toBe("gzip");
    expect(Buffer.from(await served.arrayBuffer())).toEqual(gzipSync(lines(1)));
  });

  it("takes a note that arrives after the session's first segments", async () => {
    await postSegment(0, { session: { note: null } });
    await postSegment(1, { session: { note: "الطلب لا يمر" } });
    await postSegment(2, { session: { note: "a later, different note" } });
    const { sessions } = await (
      await ctx.request(`/api/apps/${appId}/recordings`, { token: owner.token })
    ).json();
    expect(sessions[0].note).toBe("الطلب لا يمر");
  });

  it("filters by errors and pages with a cursor", async () => {
    await postSegment(0);
    await postSegment(0, {
      session: { sessionId: "0190a8d2-7c1e-7b3a-9f00-000000000002", startedAt: STARTED + 1 },
      segment: { sessionId: "0190a8d2-7c1e-7b3a-9f00-000000000002", errors: 0 },
    });

    const firstPage = await (
      await ctx.request(`/api/apps/${appId}/recordings?limit=1`, { token: owner.token })
    ).json();
    expect(firstPage.sessions).toHaveLength(1);
    expect(firstPage.next_cursor).not.toBeNull();
    const secondPage = await (
      await ctx.request(`/api/apps/${appId}/recordings?limit=1&before=${firstPage.next_cursor}`, {
        token: owner.token,
      })
    ).json();
    expect(secondPage.sessions).toHaveLength(1);
    expect(secondPage.sessions[0].id).not.toBe(firstPage.sessions[0].id);
    expect(secondPage.next_cursor).toBeNull();
  });

  it("refuses a body that is not gzip, a bad header, and another device's session", async () => {
    expect((await postSegment(0, { body: "plain text" })).status).toBe(400);
    const noHeader = await ctx.request("/api/recording/segments", {
      method: "POST",
      body: gzipSync("x"),
    });
    expect(noHeader.status).toBe(400);

    await postSegment(0);
    const stolen = await postSegment(1, { session: { deviceId: "tablet-2" } });
    expect(stolen.status).toBe(409);
  });

  it("answers 404 for an unknown app without storing anything", async () => {
    const response = await postSegment(0, { session: { appId: "com.nobody" } });
    expect(response.status).toBe(404);
  });

  it("allows the recording header across origins", async () => {
    const preflight = await ctx.request("/api/recording/segments", {
      method: "OPTIONS",
      headers: {
        origin: "https://localhost",
        "access-control-request-method": "POST",
        "access-control-request-headers": `content-type,${RECORDING_HEADER}`,
      },
    });
    expect(preflight.headers.get("access-control-allow-headers")?.toLowerCase()).toContain(
      RECORDING_HEADER,
    );
  });

  it("are deleted with their session", async () => {
    await postSegment(0);
    const { sessions } = await (
      await ctx.request(`/api/apps/${appId}/recordings`, { token: owner.token })
    ).json();
    const removed = await ctx.request(`/api/recordings/${sessions[0].id}`, {
      method: "DELETE",
      token: owner.token,
    });
    expect(removed.status).toBe(204);
    expect(
      (await ctx.request(`/api/recordings/${sessions[0].id}`, { token: owner.token })).status,
    ).toBe(404);
    expect(await ctx.deps.storage.stat(`recordings/${appId}/${SESSION}/0.ndjson.gz`)).toBeNull();
  });

  it("expire with retention, blobs included", async () => {
    await postSegment(0);
    await ctx.db
      .updateTable("recording_sessions")
      .set({ last_segment_at: new Date(Date.now() - 30 * 86_400_000) })
      .execute();
    const result = await runRetention(ctx.deps);
    expect(result.recordings).toBe(1);
    expect(await ctx.deps.storage.stat(`recordings/${appId}/${SESSION}/0.ndjson.gz`)).toBeNull();
  });
});

describe("recording assets", () => {
  const css = "body { color: red }";
  const sha = createHash("sha256").update(css).digest("hex");

  function postAsset(body: string, hash = sha, path = "/assets/index.css") {
    return ctx.request("/api/recording/assets", {
      method: "POST",
      headers: {
        "content-type": "text/css",
        [RECORDING_ASSET_HEADER]: encodeRecordingHeader({
          appId: "com.acme.app",
          versionName: "3.0.1",
          path,
          sha256: hash,
          contentType: "text/css",
        }),
      },
      body,
    });
  }

  it("are stored once per version and path, advertised to devices, and served to the dashboard", async () => {
    expect((await postAsset(css)).status).toBe(201);
    expect((await postAsset(css)).status).toBe(200);

    await putRule({ scope: "app", policy: { mode: "buffer" } });
    const { known_assets } = await (await askPolicy()).json();
    expect(known_assets).toEqual(["/assets/index.css"]);

    await postSegment(0);
    const { sessions } = await (
      await ctx.request(`/api/apps/${appId}/recordings`, { token: owner.token })
    ).json();
    const detail = await (
      await ctx.request(`/api/recordings/${sessions[0].id}`, { token: owner.token })
    ).json();
    expect(detail.assets).toHaveLength(1);
    const served = await ctx.request(`/api/recording-assets/${detail.assets[0].id}`, {
      token: owner.token,
    });
    expect(served.headers.get("content-type")).toBe("text/css");
    expect(await served.text()).toBe(css);
  });

  it("refuses a body that does not match its hash", async () => {
    const response = await postAsset("body { color: blue }");
    expect(response.status).toBe(409);
    const rows = await ctx.db.selectFrom("recording_assets").selectAll().execute();
    expect(rows).toHaveLength(0);
  });
});
