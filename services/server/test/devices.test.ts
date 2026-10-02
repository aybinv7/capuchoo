import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { classifyUpdateEvent } from "@capuchoo/core";
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
  const list = await (
    await ctx.request(`/api/apps/${appId}/devices`, { token: owner.token })
  ).json();
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
    await report([
      "download_10",
      "download_complete",
      "set",
      "download_fail",
      "app_moved_to_foreground",
    ]);
    const device = await onlyDevice();

    const detail = await (
      await ctx.request(`/api/devices/${device.id}`, { token: owner.token })
    ).json();
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
    expect(failures.events.map((event: { action: string }) => event.action)).toEqual([
      "download_fail",
    ]);
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
      await ctx.request(`/api/apps/${appId}/device-events?category=delivered`, {
        token: owner.token,
      })
    ).json();
    expect(feed.events).toHaveLength(1);
    expect(feed.events[0].device).toMatchObject({
      device_id: "tablet-1",
      attributes: { rep: "R-9" },
    });
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

describe("device activity over a range", () => {
  async function seedEvents(rows: Array<{ action: string; at: string }>) {
    await check();
    const device = await onlyDevice();
    await ctx.db
      .insertInto("device_events")
      .values(
        rows.map((row) => ({
          app_id: appId,
          device_uuid: device.id,
          channel_id: null,
          kind: "ota" as const,
          action: row.action,
          category: classifyUpdateEvent(row.action),
          status: null,
          version_from: null,
          version_to: "1.0.1",
          error: null,
          created_at: new Date(row.at),
        })),
      )
      .execute();
    return device;
  }

  it("buckets by the viewer's local day and counts per category", async () => {
    const device = await seedEvents([
      { action: "set", at: "2025-09-30T23:15:00Z" },
      { action: "set", at: "2025-10-01T10:00:00Z" },
      { action: "download_fail", at: "2025-10-01T23:30:00Z" },
      { action: "set", at: "2025-10-05T10:00:00Z" },
    ]);
    const response = await ctx.request(
      `/api/devices/${device.id}/activity?from=2025-09-30T00:00:00Z&to=2025-10-03T00:00:00Z&tz=Africa/Algiers`,
      { token: owner.token },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ bucket: "day", tz: "Africa/Algiers" });
    expect(body.totals).toMatchObject({ delivered: 2, failed: 1, check: 0 });
    expect(body.series).toEqual([
      { at: "2025-10-01", delivered: 2 },
      { at: "2025-10-02", failed: 1 },
    ]);
  });

  it("buckets by hour and filters the timeline to the same window", async () => {
    const device = await seedEvents([
      { action: "set", at: "2025-10-01T10:05:00Z" },
      { action: "set", at: "2025-10-01T10:50:00Z" },
      { action: "set", at: "2025-10-02T10:00:00Z" },
    ]);
    const hourly = await (
      await ctx.request(
        `/api/devices/${device.id}/activity?from=2025-10-01T00:00:00Z&to=2025-10-02T00:00:00Z&bucket=hour`,
        { token: owner.token },
      )
    ).json();
    expect(hourly.series).toEqual([{ at: "2025-10-01T10", delivered: 2 }]);

    const page = await (
      await ctx.request(
        `/api/devices/${device.id}/events?category=delivered&from=2025-10-01T00:00:00Z&to=2025-10-02T00:00:00Z`,
        { token: owner.token },
      )
    ).json();
    expect(page.events).toHaveLength(2);
  });

  it("refuses an unbounded, oversized or malformed window", async () => {
    await check();
    const device = await onlyDevice();
    const base = `/api/devices/${device.id}/activity`;
    for (const query of [
      "",
      "?from=2026-10-01T00:00:00Z",
      "?from=2024-01-01T00:00:00Z&to=2026-01-01T00:00:00Z",
      "?from=2026-09-01T00:00:00Z&to=2026-10-01T00:00:00Z&bucket=hour",
      "?from=2026-10-02T00:00:00Z&to=2026-10-01T00:00:00Z",
      "?from=yesterday&to=2026-10-01T00:00:00Z",
      "?from=2026-09-01T00:00:00Z&to=2026-10-01T00:00:00Z&tz=Mars/Olympus",
      "?from=2026-09-01T00:00:00Z&to=2026-10-01T00:00:00Z&bucket=week",
    ]) {
      expect((await ctx.request(`${base}${query}`, { token: owner.token })).status, query).toBe(
        400,
      );
    }
    const detail = await (
      await ctx.request(`/api/devices/${device.id}`, { token: owner.token })
    ).json();
    expect(detail.retention_days).toBe(90);
  });
});
