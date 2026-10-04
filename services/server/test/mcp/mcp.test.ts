import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { gzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { createTestContext, fakeZip, seedApp, uploadForm, type TestContext } from "../harness";

let ctx: TestContext;
let owner: { id: string; token: string };
let app: { id: string };
let channels: Record<string, { id: string; name: string }>;
let key: string;

beforeEach(async () => {
  ctx = await createTestContext();
  owner = await ctx.user("owner@acme.test");
  ({ app, channels } = await seedApp(ctx, owner.token));
  key = await ctx.key(owner.id);
});
afterEach(async () => {
  await ctx.close();
});

let ids = 0;
async function rpc(
  method: string,
  params: Record<string, unknown> = {},
  options: { key?: string | null; headers?: Record<string, string>; httpMethod?: string } = {},
) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    ...options.headers,
  };
  const token = options.key === undefined ? key : options.key;
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await ctx.request("/api/mcp", {
    method: options.httpMethod ?? "POST",
    headers,
    body:
      options.httpMethod === "GET"
        ? undefined
        : JSON.stringify({ jsonrpc: "2.0", id: ++ids, method, params }),
  });
  return { status: response.status, headers: response.headers, body: await response.json() };
}

async function call(name: string, args: Record<string, unknown>, options: { key?: string } = {}) {
  const { body } = await rpc("tools/call", { name, arguments: args }, options);
  const result = body.result as { content: Array<{ text: string }>; isError?: boolean };
  return { error: Boolean(result.isError), data: JSON.parse(result.content[0]!.text) };
}

async function publish(fields: Record<string, string>) {
  const response = await ctx.request("/api/admin/upload", {
    method: "POST",
    token: owner.token,
    body: uploadForm(
      { platform: "android", app_id: "com.acme.app", ...fields },
      fakeZip(fields.version_name ?? "x"),
    ),
  });
  expect(response.status).toBeLessThan(300);
}

describe("the MCP endpoint", () => {
  it("asks for an API key, and refuses a dashboard session", async () => {
    const none = await rpc("tools/list", {}, { key: null });
    expect(none.status).toBe(401);
    expect(none.headers.get("www-authenticate")).toContain("Bearer");
    const session = await rpc("tools/list", {}, { key: owner.token });
    expect(session.status).toBe(401);
  });

  it("lets a hosted agent call from its own origin with a key, and refuses anything but POST", async () => {
    const hosted = await rpc("tools/list", {}, { headers: { origin: "https://claude.ai" } });
    expect(hosted.status).toBe(200);
    expect(hosted.body.result.tools.length).toBeGreaterThan(0);
    const keyless = await rpc(
      "tools/list",
      {},
      { key: null, headers: { origin: "https://claude.ai" } },
    );
    expect(keyless.status).toBe(401);
    expect((await rpc("tools/list", {}, { httpMethod: "GET" })).status).toBe(405);
  });

  it("introduces itself and lists its tools with honest hints", async () => {
    const init = await rpc("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test", version: "1" },
    });
    expect(init.body.result.serverInfo.name).toBe("capuchoo");
    expect(init.body.result.instructions).toContain("confirmation");

    const { body } = await rpc("tools/list");
    const tools = new Map<string, { annotations?: Record<string, boolean> }>(
      body.result.tools.map((tool: { name: string }) => [tool.name, tool]),
    );
    const expected = [
      "list_apps",
      "app_overview",
      "channel_details",
      "list_releases",
      "list_builds",
      "build_details",
      "find_devices",
      "device_details",
      "list_sessions",
      "session_timeline",
      "list_errors",
      "error_details",
      "app_stats",
      "audit_log",
      "set_error_status",
      "set_recording_rule",
      "go_live",
      "deliver_release",
      "rollback_channel",
      "pause_channel",
      "resume_channel",
    ];
    expect(expected.filter((name) => !tools.has(name))).toEqual([]);
    expect(tools.get("session_timeline")!.annotations?.readOnlyHint).toBe(true);
    expect(tools.get("deliver_release")!.annotations?.destructiveHint).toBe(true);

    const prompts = await rpc("prompts/list");
    expect(prompts.body.result.prompts.map((prompt: { name: string }) => prompt.name)).toEqual(
      expect.arrayContaining(["investigate_error", "release_health", "device_story"]),
    );
  });

  it("only shows a scoped key its app, at its capped role", async () => {
    const other = await seedApp(ctx, owner.token, "com.other.app");
    const scoped = await ctx.key(owner.id, { appId: app.id, role: "viewer" });
    const listed = await call("list_apps", {}, { key: scoped });
    expect(listed.data.apps).toEqual([expect.objectContaining({ id: app.id, role: "viewer" })]);
    const refused = await call("app_overview", { app: other.app.id }, { key: scoped });
    expect(refused.error).toBe(true);
    expect(refused.data.reason).toBe("not_found");
  });

  it("answers an overview by bundle identifier", async () => {
    const overview = await call("app_overview", { app: "com.acme.app" });
    expect(overview.error).toBe(false);
    expect(overview.data.app.id).toBe(app.id);
    expect(overview.data.channels.map((channel: { name: string }) => channel.name).sort()).toEqual([
      "dev",
      "prod",
      "staging",
    ]);
    expect(Array.isArray(overview.data.needs_attention)).toBe(true);
  });
});

describe("delivering through MCP", () => {
  beforeEach(async () => {
    await publish({ channel: "prod", flavour: "prod", version_name: "1.0.0" });
    await publish({ channel: "prod", flavour: "prod", version_name: "1.1.0" });
  });

  async function confirmed(tool: string, args: Record<string, unknown>) {
    const preview = await call(tool, args);
    expect(preview.error).toBe(false);
    const done = await call(tool, {
      ...args,
      confirmation: preview.data.confirmation,
      confirm_channel_name: "prod",
    });
    return { preview: preview.data, done: done.data };
  }

  it("previews, then moves only with the token and the channel's name", async () => {
    const rollback = {
      app: app.id,
      channel: "prod",
      version: "1.0.0",
      reason: "1.1.0 crashes on save",
    };
    const preview = await call("rollback_channel", rollback);
    expect(preview.data.preview).toMatchObject({
      action: "roll back",
      channel: "prod",
      environment: "prod",
      from: { ota: "1.1.0" },
      to: { ota: { version: "1.0.0" } },
      needs_channel_name: true,
    });
    const token = preview.data.confirmation as string;

    const unnamed = await call("rollback_channel", { ...rollback, confirmation: token });
    expect(unnamed.data.reason).toBe("confirm_channel_name");
    const tampered = await call("rollback_channel", {
      ...rollback,
      reason: "another reason",
      confirmation: token,
      confirm_channel_name: "prod",
    });
    expect(tampered.data.reason).toBe("confirmation_mismatch");
    const asDeliver = await call("deliver_release", {
      ...rollback,
      confirmation: token,
      confirm_channel_name: "prod",
    });
    expect(asDeliver.data).not.toMatchObject({ done: true });

    const done = await call("rollback_channel", {
      ...rollback,
      confirmation: token,
      confirm_channel_name: "prod",
    });
    expect(done.data).toMatchObject({ done: true, channel: "prod" });

    const forward = await confirmed("deliver_release", {
      app: app.id,
      channel: "prod",
      version: "1.1.0",
      reason: "fixed in the backend",
    });
    expect(forward.done).toMatchObject({ done: true });

    const detail = await call("channel_details", { channel: channels.prod!.id });
    expect(detail.data.serving.ota.version).toBe("1.1.0");
    expect(
      detail.data.history.slice(0, 2).map((entry: { reason: string }) => entry.reason),
    ).toEqual(["fixed in the backend", "1.1.0 crashes on save"]);
  });

  it("says there is nothing to do when the channel already serves it", async () => {
    const same = await call("deliver_release", {
      app: app.id,
      channel: "prod",
      version: "1.1.0",
      reason: "make sure it is out",
    });
    expect(same.data).toMatchObject({ done: true, changed: false });
    expect(same.data.confirmation).toBeUndefined();
  });

  it("reports the server's refusal instead of a token", async () => {
    const backwards = await call("deliver_release", {
      app: app.id,
      channel: "prod",
      version: "1.0.0",
      reason: "go back without saying so",
    });
    expect(backwards.data.preview).toBeUndefined();
    expect(backwards.data).toMatchObject({ refused: true, reason: "downgrade-needs-rollback" });
  });

  it("pauses with confirmation and will not let a viewer key do it", async () => {
    const viewer = await ctx.key(owner.id, { role: "viewer" });
    const refused = await call(
      "pause_channel",
      { app: app.id, channel: "prod", reason: "investigating" },
      { key: viewer },
    );
    expect(refused.error).toBe(true);
    expect(refused.data.reason).toBe("forbidden");

    const paused = await confirmed("pause_channel", {
      app: app.id,
      channel: "prod",
      reason: "investigating",
    });
    expect(paused.done).toMatchObject({ done: true, paused: true, changed: true });
  });
});

describe("reading a session", () => {
  it("turns stored segments into a timeline around the error, with query values hidden", async () => {
    const started = Date.now() - 120_000;
    const lines = [
      { k: "replay", t: started, d: { type: 2, data: { node: {} } } },
      { k: "marker", t: started + 1000, d: { kind: "route", url: "/orders/new" } },
      {
        k: "marker",
        t: started + 20_000,
        d: { kind: "step", action: "tap", target: { name: "Apply", id: "apply", css: "#apply" } },
      },
      {
        k: "network",
        t: started + 21_000,
        d: {
          method: "GET",
          url: "https://api.acme.test/v2/orders?token=secret123",
          status: 502,
          duration: 340,
        },
      },
      {
        k: "console",
        t: started + 22_000,
        d: {
          level: "error",
          text: "Uncaught TypeError: x is undefined",
          stack:
            "TypeError: x is undefined\n    at total (https://app.acme.test/assets/index.js:1:42)",
          source: "uncaught",
        },
      },
    ];
    const body = gzipSync(Buffer.from(`${lines.map((line) => JSON.stringify(line)).join("\n")}\n`));
    const session = await ctx.db
      .insertInto("recording_sessions")
      .values({
        app_id: app.id,
        session_key: randomUUID(),
        device_id: "tablet-1",
        platform: "android",
        version_name: "1.0.0",
        start: "error",
        mode: "buffer",
        started_at: new Date(started),
        ended_at: new Date(started + 60_000),
        last_segment_at: new Date(started + 60_000),
        segment_count: 1,
        error_count: 1,
        finished: true,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    const storageKey = `recordings/${app.id}/${session.id}/0-${randomUUID()}.ndjson.gz`;
    await ctx.deps.storage.put(storageKey, Readable.from(body), "application/gzip");
    await ctx.db
      .insertInto("recording_segments")
      .values({
        session_id: session.id,
        seq: 0,
        storage_key: storageKey,
        size_bytes: body.length,
        raw_bytes: body.length,
        events: lines.length,
        errors: 1,
        full_snapshot: true,
        started_at: new Date(started),
        ended_at: new Date(started + 60_000),
      })
      .execute();

    const map = {
      version: 3,
      file: "index.js",
      sources: ["../src/orders/totals.ts"],
      sourcesContent: [
        ["export function total(order) {", "  return order.lines.length;", "}", ""].join("\n"),
      ],
      names: ["total"],
      mappings: "AACA",
    };
    const uploaded = await ctx.request(
      `/api/apps/${app.id}/source-maps?version=1.0.0&path=assets/index.js.map`,
      { method: "PUT", token: owner.token, body: JSON.stringify(map) },
    );
    expect(uploaded.status).toBeLessThan(300);

    const timeline = await call("session_timeline", { session: session.id });
    expect(timeline.error).toBe(false);
    expect(timeline.data.counts).toMatchObject({
      steps: 1,
      errors: 1,
      requests: 1,
      failed_requests: 1,
    });
    expect(timeline.data.errors[0]).toMatchObject({
      at: "0:22",
      message: "Uncaught TypeError: x is undefined",
    });
    expect(timeline.data.timeline).toEqual(
      expect.arrayContaining([
        '0:20 [step] tap "Apply" (#apply)',
        "0:21 [request] GET api.acme.test/v2/orders?token=… 502 340ms [FAILED]",
      ]),
    );
    expect(JSON.stringify(timeline.data)).not.toContain("secret123");
    expect(timeline.data.errors[0].stack[0]).toMatchObject({
      source: "src/orders/totals.ts",
      line: 2,
      library: false,
      mapped: true,
    });
    expect(timeline.data.errors[0].stack[0].code).toContain("> 2 |   return order.lines.length;");

    const listed = await call("list_sessions", { app: app.id, errors_only: true });
    expect(listed.data.sessions[0]).toMatchObject({
      id: session.id,
      errors: 1,
      started_by: "error",
    });
  });
});

describe("the rest of the tools", () => {
  beforeEach(async () => {
    await publish({ channel: "prod", flavour: "prod", version_name: "1.0.0" });
    const check = await ctx.request("/api/update", {
      method: "POST",
      json: {
        app_id: "com.acme.app",
        device_id: "tablet-1",
        platform: "android",
        version_name: "builtin",
        version_code: "10",
        defaultChannel: "prod",
      },
    });
    if (check.status >= 300) throw new Error(`update check answered ${check.status}`);
  });

  it("answers every read tool on a real app", async () => {
    const devices = await call("find_devices", { app: app.id, query: "tablet" });
    expect(devices.data.devices[0]).toMatchObject({ device_id: "tablet-1" });
    const device = await call("device_details", { app: app.id, device: "tablet-1" });
    expect(device.data.device).toMatchObject({ device_id: "tablet-1" });

    const releases = await call("list_releases", { app: app.id, kind: "ota" });
    expect(releases.data.ota[0]).toMatchObject({ version: "1.0.0", served_by: ["prod"] });

    for (const [tool, args] of [
      ["list_builds", { app: app.id }],
      ["app_stats", { app: app.id, view: "both", days: 7 }],
      ["audit_log", { app: app.id }],
      ["list_errors", { app: app.id, status: "all" }],
      ["list_sessions", { app: app.id }],
    ] as const) {
      const answer = await call(tool, args);
      expect({ tool, error: answer.error }).toEqual({ tool, error: false });
    }
  });

  it("changes recording rules and puts a device live, and says so in the audit log", async () => {
    const rule = await call("set_recording_rule", {
      app: app.id,
      scope: "channel",
      target: "prod",
      policy: { mode: "buffer", bogus: true },
    });
    expect(rule.error).toBe(false);
    expect(rule.data.rule.policy).toMatchObject({ mode: "buffer" });
    expect(rule.data.rule.policy.bogus).toBeUndefined();

    const live = await call("go_live", { app: app.id, device: "tablet-1", minutes: 5 });
    expect(live.data.live_until).not.toBeNull();
    const ended = await call("go_live", { app: app.id, device: "tablet-1", minutes: 0 });
    expect(ended.data.live_until).toBeNull();

    const audit = await call("audit_log", { app: app.id });
    const viaMcp = audit.data.entries.filter(
      (entry: { details: { via?: string } }) => entry.details?.via === "mcp",
    );
    expect(viaMcp.map((entry: { action: string }) => entry.action)).toEqual(
      expect.arrayContaining(["recording_rule.create", "recording_rule.update"]),
    );
  });

  it("resolves an error once, and audits it", async () => {
    const now = ctx.deps.now();
    const issue = await ctx.db
      .insertInto("recording_issues")
      .values({
        app_id: app.id,
        fingerprint: "f",
        message: "TypeError: nope",
        occurrences: 2,
        first_version: "1.0.0",
        last_version: "1.0.0",
        first_seen: now,
        last_seen: now,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    const detail = await call("error_details", { error: issue.id });
    expect(detail.data.error).toMatchObject({ message: "TypeError: nope", status: "open" });

    const first = await call("set_error_status", {
      error: issue.id,
      status: "resolved",
      note: "fixed in 1.0.1",
    });
    expect(first.data).toMatchObject({ status: "resolved", changed: true });
    const again = await call("set_error_status", { error: issue.id, status: "resolved" });
    expect(again.data.changed).toBe(false);

    const audit = await call("audit_log", { app: app.id });
    expect(audit.data.entries[0]).toMatchObject({
      action: "recording_issue.resolve",
      details: { via: "mcp", note: "fixed in 1.0.1" },
    });
  });
});
