import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { relaySocket } from "../src/services/assist/relay";
import { CLOSE, type AssistSocket } from "../src/services/assist/socket";
import { silentLogger } from "../src/lib/logger";
import { createTestContext, seedApp, type TestContext } from "./harness";

let ctx: TestContext;
let owner: { id: string; token: string };
let appId: string;
let deviceUuid: string;

class FakeSocket implements AssistSocket {
  sent: Array<Record<string, unknown>> = [];
  raw: string[] = [];
  closed: { code: number; reason: string } | null = null;
  buffered = 0;
  private messageHandler: ((data: string, bytes: number) => void) | null = null;
  private closeHandler: (() => void) | null = null;

  send(data: string) {
    if (this.closed) throw new Error("closed");
    this.raw.push(data);
    this.sent.push(JSON.parse(data));
  }
  close(code: number, reason: string) {
    if (this.closed) return;
    this.closed = { code, reason };
    this.closeHandler?.();
  }
  onMessage(handler: (data: string, bytes: number) => void) {
    this.messageHandler = handler;
  }
  onClose(handler: () => void) {
    this.closeHandler = handler;
  }
  receive(message: unknown) {
    const text = typeof message === "string" ? message : JSON.stringify(message);
    this.messageHandler?.(text, Buffer.byteLength(text));
  }
  last() {
    return this.sent.at(-1);
  }
}

function connect(): FakeSocket {
  const socket = new FakeSocket();
  relaySocket(socket, ctx.deps.assist, {
    now: () => ctx.deps.now().getTime(),
    logger: silentLogger,
  });
  return socket;
}

async function startAssist(token = owner.token) {
  return ctx.request(`/api/devices/${deviceUuid}/assist`, { method: "POST", token });
}

const askPolicy = (extra: Record<string, unknown> = {}) =>
  ctx.request("/api/recording/policy", {
    method: "POST",
    json: {
      appId: "com.acme.app",
      deviceId: "tablet-1",
      platform: "android",
      versionName: "3.0.1",
      versionCode: 42,
      channel: "prod",
      ...extra,
    },
  });

async function auditActions() {
  await ctx.deps.tasks.idle();
  const rows = await ctx.db
    .selectFrom("audit_log")
    .select(["action", "details"])
    .where("action", "like", "assist.%")
    .orderBy("created_at")
    .execute();
  return rows.map((row) => row.action);
}

/** An agent and a device both in, the way the dashboard and the app join. */
async function joined() {
  const started = await (await startAssist()).json();
  const invite = (await (await askPolicy()).json()).assist;
  const agent = connect();
  agent.receive({ t: "hello", session: started.session.id, role: "agent", ticket: started.ticket });
  const device = connect();
  device.receive({ t: "hello", session: invite.session, role: "device", ticket: invite.ticket });
  return { started, invite, agent, device };
}

beforeEach(async () => {
  ctx = await createTestContext();
  owner = await ctx.user("owner@acme.test");
  appId = (await seedApp(ctx, owner.token)).app.id;
  await ctx.request("/api/update", {
    method: "POST",
    json: { app_id: "com.acme.app", device_id: "tablet-1", platform: "android" },
  });
  deviceUuid = (
    await (await ctx.request(`/api/apps/${appId}/devices`, { token: owner.token })).json()
  ).devices[0].id;
});
afterEach(async () => {
  ctx.deps.assist.closeAll();
  await ctx.close();
});

describe("assist", () => {
  it("is for testers and above, and hands the agent a ticket and where to connect", async () => {
    const keyFor = async (role: string) =>
      (
        await (
          await ctx.request("/api/api-keys", {
            method: "POST",
            token: owner.token,
            json: { name: role, role },
          })
        ).json()
      ).key as string;
    expect((await startAssist(await keyFor("viewer"))).status).toBe(403);

    const response = await startAssist(await keyFor("tester"));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.ticket).toMatch(/^[\w-]{43}$/);
    expect(body.socket_url).toBe("ws://capuchoo.test/api/assist/ws");
    expect(body.session).toMatchObject({ status: "waiting", control: "none" });
  });

  it("reaches the device through the request it already holds open", async () => {
    const { policy } = await (await askPolicy()).json();
    const started = Date.now();
    const held = askPolicy({ known: policy.version, wait: 20 });
    await new Promise((resolve) => setTimeout(resolve, 150));
    const session = (await (await startAssist()).json()).session;
    const answer = await (await held).json();
    expect(Date.now() - started).toBeLessThan(5000);
    expect(answer.assist).toMatchObject({ session: session.id, agent: "owner" });
    expect(answer.assist.ticket).toMatch(/^[\w-]{43}$/);
  });

  it("keeps holding a device's request once it has the invite, instead of repeating it", async () => {
    const { policy } = await (await askPolicy()).json();
    const session = (await (await startAssist()).json()).session;
    const started = Date.now();
    const held = askPolicy({ known: policy.version, wait: 1, assist_seen: session.id });
    expect((await (await held).json()).assist).toMatchObject({ session: session.id });
    expect(Date.now() - started).toBeGreaterThanOrEqual(900);
  });

  it("lets nobody in without the right ticket, and each ticket in once", async () => {
    const started = await (await startAssist()).json();
    const stranger = connect();
    stranger.receive({ t: "hello", session: started.session.id, role: "agent", ticket: "guess" });
    expect(stranger.closed?.code).toBe(CLOSE.unauthorized);
    expect(stranger.last()).toMatchObject({ t: "error", code: "unauthorized" });

    const asDevice = connect();
    asDevice.receive({
      t: "hello",
      session: started.session.id,
      role: "device",
      ticket: started.ticket,
    });
    expect(asDevice.closed?.code).toBe(CLOSE.unauthorized);

    const agent = connect();
    agent.receive({
      t: "hello",
      session: started.session.id,
      role: "agent",
      ticket: started.ticket,
    });
    expect(agent.last()).toEqual({ t: "ready", peer: false, control: "none" });
    const again = connect();
    again.receive({
      t: "hello",
      session: started.session.id,
      role: "agent",
      ticket: started.ticket,
    });
    expect(again.closed?.code).toBe(CLOSE.unauthorized);

    const silent = connect();
    silent.receive({ t: "tap", x: 1, y: 1 });
    expect(silent.closed?.code).toBe(CLOSE.unauthorized);
  });

  it("relays the screen to the agent as it came", async () => {
    const { agent, device } = await joined();
    expect(agent.last()).toEqual({ t: "peer", present: true });
    const screen = JSON.stringify({ t: "events", events: [{ type: 2, data: { node: {} } }] });
    device.receive(screen);
    expect(agent.raw.at(-1)).toBe(screen);
  });

  it("drives the app only once the user granted control, and stops when they take it back", async () => {
    const { agent, device } = await joined();
    agent.receive({ t: "tap", x: 10, y: 20 });
    expect(agent.last()).toMatchObject({ t: "error", code: "no_control" });
    expect(device.sent.some((message) => message.t === "tap")).toBe(false);

    agent.receive({ t: "control" });
    expect(device.last()).toEqual({ t: "control" });
    agent.receive({ t: "pointer", x: 5, y: 5 });
    expect(device.last()).toEqual({ t: "pointer", x: 5, y: 5 });

    device.receive({ t: "control", state: "granted" });
    expect(agent.last()).toEqual({ t: "control", state: "granted" });
    agent.receive({ t: "tap", x: 10, y: 20, script: "alert(1)" });
    expect(device.last()).toEqual({ t: "tap", x: 10, y: 20 });

    device.receive({ t: "control", state: "none" });
    agent.receive({ t: "type", text: "hello" });
    expect(agent.last()).toMatchObject({ code: "no_control" });
  });

  it("ends for both sides when the user stops it, and keeps the story in the audit log", async () => {
    const { agent, device } = await joined();
    device.receive({ t: "control", state: "granted" });
    device.receive({ t: "end", reason: "user" });
    expect(agent.last()).toEqual({ t: "end", reason: "user" });
    expect(agent.closed?.code).toBe(CLOSE.ended);
    expect(device.closed?.code).toBe(CLOSE.ended);
    expect(await auditActions()).toEqual([
      "assist.request",
      "assist.accept",
      "assist.control",
      "assist.end",
    ]);
  });

  it("ends when either side's socket drops, since a used ticket cannot rejoin", async () => {
    const { agent, device, started } = await joined();
    agent.close(1006, "gone");
    expect(device.closed?.code).toBe(CLOSE.ended);
    expect(ctx.deps.assist.get(started.session.id)).toBeNull();
  });

  it("lets the user decline before anything connects", async () => {
    await startAssist();
    const invite = (await (await askPolicy()).json()).assist;
    const wrong = await ctx.request("/api/recording/assist/decline", {
      method: "POST",
      json: { session: invite.session, ticket: "nope" },
    });
    expect(wrong.status).toBe(404);
    const declined = await ctx.request("/api/recording/assist/decline", {
      method: "POST",
      json: { session: invite.session, ticket: invite.ticket },
    });
    expect(await declined.json()).toEqual({ declined: true });
    expect((await (await askPolicy()).json()).assist).toBeUndefined();
  });

  it("refuses an oversized command and one too many", async () => {
    const { agent } = await joined();
    agent.receive({ t: "type", text: "x".repeat(5000) });
    expect(agent.closed?.code).toBe(CLOSE.tooBig);

    const second = await joined();
    for (let index = 0; index < 60; index++) second.agent.receive({ t: "pointer", x: 1, y: 1 });
    expect(second.agent.sent.some((message) => message.code === "rate")).toBe(true);
  });

  it("replaces a device's earlier session when an agent asks again", async () => {
    const first = await (await startAssist()).json();
    const agent = connect();
    agent.receive({ t: "hello", session: first.session.id, role: "agent", ticket: first.ticket });
    await startAssist();
    expect(agent.last()).toEqual({ t: "end", reason: "replaced" });
  });
});
