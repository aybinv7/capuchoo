import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { createTestContext, seedApp, type TestContext } from "./harness";

let ctx: TestContext;
let owner: { id: string; token: string };
let appId: string;

const identity = { app_id: "com.acme.app", device_id: "tablet-1", platform: "android" };

beforeEach(async () => {
  ctx = await createTestContext();
  owner = await ctx.user("owner@acme.test");
  appId = (await seedApp(ctx, owner.token)).app.id;
});
afterEach(async () => {
  await ctx.close();
});

function check(extra: Record<string, unknown> = {}) {
  return ctx.request("/api/update", {
    method: "POST",
    json: { ...identity, version_name: "builtin", version_code: "10", ...extra },
  });
}

function setAttributes(attributes: unknown, deviceId = identity.device_id) {
  return ctx.request("/api/device_attributes", {
    method: "POST",
    json: { ...identity, device_id: deviceId, attributes },
  });
}

async function onlyDevice() {
  const list = await (await ctx.request(`/api/apps/${appId}/devices`, { token: owner.token })).json();
  expect(list.devices).toHaveLength(1);
  return list.devices[0];
}

describe("device attributes", () => {
  it("are stored from an update check and kept when a later check omits them", async () => {
    await check({ attributes: { rep: "R-1042", route: "Oran West", nested: { no: 1 } } });
    expect((await onlyDevice()).attributes).toEqual({ rep: "R-1042", route: "Oran West" });
    await check();
    expect((await onlyDevice()).attributes).toEqual({ rep: "R-1042", route: "Oran West" });
  });

  it("are replaced on their own endpoint, cleared with an empty object, and say what was dropped", async () => {
    expect((await setAttributes({ rep: "R-1" })).status).toBe(404);
    await check();
    const response = await setAttributes({ rep: "R-2", "bad key": "x" });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      attributes: { rep: "R-2" },
      dropped: [{ key: "bad key" }],
    });
    expect((await onlyDevice()).attributes).toEqual({ rep: "R-2" });
    await setAttributes({});
    expect((await onlyDevice()).attributes).toEqual({});
    expect((await setAttributes("rep=R-3")).status).toBe(400);
  });

  it("are matched by the device search", async () => {
    await check({ attributes: { route: "Oran West" } });
    const hit = await (
      await ctx.request(`/api/apps/${appId}/devices?search=oran`, { token: owner.token })
    ).json();
    expect(hit.total).toBe(1);
    const miss = await (
      await ctx.request(`/api/apps/${appId}/devices?search=tlemcen`, { token: owner.token })
    ).json();
    expect(miss.total).toBe(0);
  });
});

describe("device detail and activity", () => {
  async function report(actions: string[]) {
    const response = await ctx.request("/api/stats", {
      method: "POST",
      json: actions.map((action) => ({ ...identity, action, version_name: "1.0.1" })),
    });
    expect(response.status).toBe(200);
  }

  it("summarises what a device did and pages its classified timeline", async () => {
    await check({ attributes: { rep: "R-7" } });
    await report(["download_10", "download_complete", "set", "download_fail", "app_moved_to_foreground"]);
    const device = await onlyDevice();

    const detail = await (await ctx.request(`/api/devices/${device.id}`, { token: owner.token })).json();
    expect(detail.summary).toMatchObject({ days: 30, delivered: 2, failed: 1 });
    expect(detail.summary.last_delivered.version).toBe("1.0.1");
    expect(detail.summary.last_failure.action).toBe("download_fail");
    expect(detail.attributes).toEqual({ rep: "R-7" });

    const first = await (
      await ctx.request(`/api/devices/${device.id}/events?limit=2`, { token: owner.token })
    ).json();
    expect(first.events).toHaveLength(2);
    expect(first.events[0].category).toBeTypeOf("string");
    expect(first.next).not.toBeNull();
    const second = await (
      await ctx.request(`/api/devices/${device.id}/events?limit=2&before=${first.next}`, {
        token: owner.token,
      })
    ).json();
    expect(Number(second.events[0].id)).toBeLessThan(Number(first.events[1].id));

    const failures = await (
      await ctx.request(`/api/devices/${device.id}/events?category=failed`, { token: owner.token })
    ).json();
    expect(failures.events.map((event: { action: string }) => event.action)).toEqual(["download_fail"]);
    expect(failures.next).toBeNull();

    const unknown = await ctx.request(`/api/devices/${device.id}/events?category=nope`, {
      token: owner.token,
    });
    expect(unknown.status).toBe(400);
  });

  it("lists every device's events with the device they came from", async () => {
    await check({ attributes: { rep: "R-9" } });
    await report(["set"]);
    const feed = await (
      await ctx.request(`/api/apps/${appId}/device-events?category=delivered`, { token: owner.token })
    ).json();
    expect(feed.events).toHaveLength(1);
    expect(feed.events[0].device).toMatchObject({ device_id: "tablet-1", attributes: { rep: "R-9" } });
  });

  it("is hidden from someone outside the app", async () => {
    await check();
    const device = await onlyDevice();
    const stranger = await ctx.user("stranger@elsewhere.test");
    const detail = await ctx.request(`/api/devices/${device.id}`, { token: stranger.token });
    expect([403, 404]).toContain(detail.status);
    const feed = await ctx.request(`/api/apps/${appId}/device-events`, { token: stranger.token });
    expect([403, 404]).toContain(feed.status);
  });
});
