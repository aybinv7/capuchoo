import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { attachAssistSockets } from "../src/services/assist/ws-server";
import { createTestContext, seedApp, type TestContext } from "./harness";

let ctx: TestContext;
let server: Server;
let detach: () => void;
let base: string;

function open(path = "/api/assist/ws"): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`${base}${path}`);
    socket.addEventListener("open", () => resolve(socket), { once: true });
    socket.addEventListener("error", () => reject(new Error("socket refused")), { once: true });
  });
}

const next = (socket: WebSocket) =>
  new Promise<Record<string, unknown>>((resolve) =>
    socket.addEventListener("message", (event) => resolve(JSON.parse(String(event.data))), {
      once: true,
    }),
  );

const closed = (socket: WebSocket) =>
  new Promise<number>((resolve) =>
    socket.addEventListener("close", (event) => resolve(event.code), { once: true }),
  );

beforeEach(async () => {
  ctx = await createTestContext();
  server = createServer();
  detach = attachAssistSockets(server, ctx.deps);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `ws://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(async () => {
  detach();
  await new Promise((resolve) => server.close(resolve));
  await ctx.close();
});

describe("assist sockets", () => {
  it("carry a session end to end over real WebSockets", async () => {
    const owner = await ctx.user("owner@acme.test");
    const appId = (await seedApp(ctx, owner.token)).app.id;
    await ctx.request("/api/update", {
      method: "POST",
      json: { app_id: "com.acme.app", device_id: "tablet-1", platform: "android" },
    });
    const deviceUuid = (
      await (await ctx.request(`/api/apps/${appId}/devices`, { token: owner.token })).json()
    ).devices[0].id;
    const started = await (
      await ctx.request(`/api/devices/${deviceUuid}/assist`, { method: "POST", token: owner.token })
    ).json();
    const invite = ctx.deps.assist.inviteFor(appId, "tablet-1")!;

    const agent = await open();
    agent.send(
      JSON.stringify({
        t: "hello",
        session: started.session.id,
        role: "agent",
        ticket: started.ticket,
      }),
    );
    expect(await next(agent)).toEqual({ t: "ready", peer: false, control: "none" });

    const device = await open();
    const agentHearsPeer = next(agent);
    device.send(
      JSON.stringify({
        t: "hello",
        session: invite.session,
        role: "device",
        ticket: invite.ticket,
      }),
    );
    expect(await next(device)).toEqual({ t: "ready", peer: true, control: "none" });
    expect(await agentHearsPeer).toEqual({ t: "peer", present: true });

    const screen = next(agent);
    device.send(JSON.stringify({ t: "events", events: [{ type: 4, data: { width: 393 } }] }));
    expect(await screen).toEqual({ t: "events", events: [{ type: 4, data: { width: 393 } }] });

    const deviceClosed = closed(device);
    agent.send(JSON.stringify({ t: "end" }));
    expect(await deviceClosed).toBe(4002);
  });

  it("refuses any other path", async () => {
    await expect(open("/api/other")).rejects.toThrow();
  });

  it("closes a socket that never says hello", async () => {
    const socket = await open();
    const code = closed(socket);
    socket.send("not json");
    expect(await code).toBe(4001);
  });
});
