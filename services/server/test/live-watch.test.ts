import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { silentLogger } from "../src/lib/logger";
import { CLOSE, type AssistSocket } from "../src/services/assist/socket";
import { relayWatchSocket } from "../src/services/live/watch-relay";
import { createTestContext, seedApp, type TestContext } from "./harness";

let ctx: TestContext;
let owner: { id: string; token: string };
let appId: string;
let deviceUuid: string;

class FakeSocket implements AssistSocket {
  raw: string[] = [];
  closed: number | null = null;
  buffered = 0;
  private message: ((data: string, bytes: number) => void) | null = null;
  private close_: (() => void) | null = null;
  send(data: string) {
    if (this.closed !== null) throw new Error("closed");
    this.raw.push(data);
  }
  close(code: number) {
    if (this.closed !== null) return;
    this.closed = code;
    this.close_?.();
  }
  onMessage(handler: (data: string, bytes: number) => void) {
    this.message = handler;
  }
  onClose(handler: () => void) {
    this.close_ = handler;
  }
  receive(message: unknown) {
    const text = typeof message === "string" ? message : JSON.stringify(message);
    this.message?.(text, Buffer.byteLength(text));
  }
  sent() {
    return this.raw.map((text) => JSON.parse(text) as Record<string, unknown>);
  }
}

function connect(): FakeSocket {
  const socket = new FakeSocket();
  relayWatchSocket(socket, ctx.deps.watch, {
    now: () => ctx.deps.now().getTime(),
    logger: silentLogger,
  });
  return socket;
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

const goLive = () =>
  ctx.request(`/api/apps/${appId}/recording-rules`, {
    method: "PUT",
    token: owner.token,
    json: { scope: "device", device_id: deviceUuid, live_minutes: 10 },
  });

const watch = () =>
  ctx.request(`/api/devices/${deviceUuid}/watch`, { method: "POST", token: owner.token });

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
  ctx.deps.watch.closeAll();
  await ctx.close();
});

describe("watching a live device", () => {
  it("is only for a device its rules put live", async () => {
    expect((await watch()).status).toBe(409);
    await goLive();
    const response = await watch();
    expect(response.status).toBe(201);
    expect((await response.json()).socket_url).toBe("ws://capuchoo.test/api/live/ws");
  });

  it("reaches the device through its held policy request", async () => {
    await goLive();
    const { policy } = await (await askPolicy()).json();
    const held = askPolicy({ known: policy.version, wait: 20 });
    await new Promise((resolve) => setTimeout(resolve, 150));
    const { room } = await (await watch()).json();
    const started = Date.now();
    expect((await (await held).json()).watch).toMatchObject({ room });
    expect(Date.now() - started).toBeLessThan(3000);
  });

  it("sends the screen to every viewer as it came, and asks for a snapshot when one joins", async () => {
    await goLive();
    const first = await (await watch()).json();
    const second = await (await watch()).json();
    expect(second.room).toBe(first.room);
    const invite = ctx.deps.watch.inviteFor(appId, "tablet-1")!;

    const device = connect();
    device.receive({ t: "hello", room: invite.room, role: "device", ticket: invite.ticket });
    const a = connect();
    a.receive({ t: "hello", room: first.room, role: "viewer", ticket: first.ticket });
    expect(a.sent()[0]).toEqual({ t: "ready", device: true });
    expect(device.sent()).toEqual([{ t: "snapshot" }]);
    const b = connect();
    b.receive({ t: "hello", room: second.room, role: "viewer", ticket: second.ticket });
    expect(device.sent()).toHaveLength(2);

    const screen = JSON.stringify({ t: "events", events: [{ type: 3, data: { source: 0 } }] });
    device.receive(screen);
    expect(a.raw.at(-1)).toBe(screen);
    expect(b.raw.at(-1)).toBe(screen);

    a.receive({ t: "tap", x: 1, y: 1 });
    expect(device.raw.some((text) => text.includes("tap"))).toBe(false);
  });

  it("lets nobody in with a wrong or reused ticket", async () => {
    await goLive();
    const { room, ticket } = await (await watch()).json();
    const stranger = connect();
    stranger.receive({ t: "hello", room, role: "viewer", ticket: "guess" });
    expect(stranger.closed).toBe(CLOSE.unauthorized);
    expect(stranger.sent()[0]).toMatchObject({ t: "error", code: "unauthorized" });
    const viewer = connect();
    viewer.receive({ t: "hello", room, role: "viewer", ticket });
    const again = connect();
    again.receive({ t: "hello", room, role: "viewer", ticket });
    expect(again.closed).toBe(CLOSE.unauthorized);
  });

  it("asks the device to come back when its socket drops, and tells the viewers", async () => {
    await goLive();
    const { room, ticket } = await (await watch()).json();
    const invite = ctx.deps.watch.inviteFor(appId, "tablet-1")!;
    const viewer = connect();
    viewer.receive({ t: "hello", room, role: "viewer", ticket });
    const device = connect();
    device.receive({ t: "hello", room: invite.room, role: "device", ticket: invite.ticket });
    expect(ctx.deps.watch.inviteFor(appId, "tablet-1")).toBeNull();
    device.close(1006);
    expect(viewer.sent().at(-1)).toEqual({ t: "device", present: false });
    expect(ctx.deps.watch.inviteFor(appId, "tablet-1")).toMatchObject({ room });
  });
});
