import { classifyUpdateEvent } from "@capuchoo/core";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { createTestContext, fakeZip, seedApp, uploadForm, type TestContext } from "./harness";

let ctx: TestContext;
let owner: { id: string; token: string };
let appId: string;
let prodId: string;

beforeEach(async () => {
  ctx = await createTestContext();
  owner = await ctx.user("owner@acme.test");
  const seeded = await seedApp(ctx, owner.token);
  appId = seeded.app.id;
  prodId = seeded.channels.prod!.id;
});
afterEach(async () => {
  await ctx.close();
});

async function publish(version: string) {
  const response = await ctx.request("/api/admin/upload", {
    method: "POST",
    token: owner.token,
    body: uploadForm(
      {
        app_id: "com.acme.app",
        platform: "android",
        flavour: "prod",
        channel: "prod",
        version_name: version,
      },
      fakeZip(version),
    ),
  });
  expect(response.status).toBe(201);
}

function check(deviceId: string, version: string) {
  return ctx.request("/api/update", {
    method: "POST",
    json: {
      app_id: "com.acme.app",
      device_id: deviceId,
      platform: "android",
      version_name: version,
      version_code: "10",
      defaultChannel: "prod",
      attributes: { rep: `R-${deviceId}` },
    },
  });
}

async function delivered(deviceId: string, version: string, at: Date) {
  const device = await ctx.db
    .selectFrom("devices")
    .select("id")
    .where("device_id", "=", deviceId)
    .executeTakeFirstOrThrow();
  await ctx.db
    .insertInto("device_events")
    .values({
      app_id: appId,
      device_uuid: device.id,
      channel_id: prodId,
      kind: "ota",
      action: "set",
      category: classifyUpdateEvent("set"),
      status: "delivered",
      version_from: null,
      version_to: version,
      error: null,
      created_at: at,
    })
    .execute();
}

describe("channel rollout", () => {
  it("reports the version mix, the devices behind and the adoption curve since delivery", async () => {
    await publish("1.0.0");
    await publish("1.1.0");
    await check("a", "1.1.0");
    await check("b", "1.1.0");
    await check("c", "1.0.0");
    await check("d", "builtin");
    const now = Date.now();
    await delivered("a", "1.1.0", new Date(now + 60_000));
    await delivered("b", "1.1.0", new Date(now + 120_000));
    await delivered("b", "1.1.0", new Date(now + 180_000));

    const response = await ctx.request(`/api/channels/${prodId}/rollout?tz=Africa/Algiers`, {
      token: owner.token,
    });
    expect(response.status).toBe(200);
    const rollout = await response.json();
    expect(rollout.current).toMatchObject({
      version: "1.1.0",
      from_version: "1.0.0",
      rollback: false,
      delivered_by: "owner@acme.test",
    });
    expect(rollout).toMatchObject({ devices: 4, on_current: 2 });
    expect(rollout.mix[0]).toEqual({ version: "1.1.0", devices: 2, current: true });
    expect(rollout.mix.map((row: { version: string }) => row.version).sort()).toEqual([
      "1.0.0",
      "1.1.0",
      "builtin",
    ]);
    expect(rollout.behind.map((row: { device_id: string }) => row.device_id).sort()).toEqual([
      "c",
      "d",
    ]);
    expect(rollout.behind[0].attributes.rep).toMatch(/^R-/);
    expect(rollout.curve.at(-1).devices).toBe(2);
  });

  it("is empty but well-formed for a channel that never served anything", async () => {
    const rollout = await (
      await ctx.request(`/api/channels/${prodId}/rollout`, { token: owner.token })
    ).json();
    expect(rollout).toMatchObject({
      current: null,
      devices: 0,
      on_current: 0,
      mix: [],
      behind: [],
      curve: [],
    });
  });

  it("refuses an unknown time zone and a stranger", async () => {
    expect(
      (await ctx.request(`/api/channels/${prodId}/rollout?tz=Nowhere/Land`, { token: owner.token }))
        .status,
    ).toBe(400);
    const stranger = await ctx.user("stranger@elsewhere.test");
    expect([403, 404]).toContain(
      (await ctx.request(`/api/channels/${prodId}/rollout`, { token: stranger.token })).status,
    );
  });
});

describe("devices behind their channel", () => {
  it("filters the device list by version and by lagging the channel's bundle", async () => {
    await publish("1.0.0");
    await publish("1.1.0");
    await check("a", "1.1.0");
    await check("c", "1.0.0");
    await check("d", "builtin");
    const ids = async (query: string) =>
      (
        await (
          await ctx.request(`/api/apps/${appId}/devices?${query}`, { token: owner.token })
        ).json()
      ).devices
        .map((row: { device_id: string }) => row.device_id)
        .sort();
    expect(await ids(`channel_id=${prodId}&behind=true`)).toEqual(["c", "d"]);
    expect(await ids("version=builtin")).toEqual(["d"]);
    expect(await ids("version=1.0.0&behind=true")).toEqual(["c"]);
    expect(await ids("behind=false")).toEqual(["a", "c", "d"]);
  });
});

describe("channel activity", () => {
  it("counts only this channel's events in the window", async () => {
    await publish("1.0.0");
    await check("a", "1.0.0");
    await delivered("a", "1.0.0", new Date("2025-03-10T09:00:00Z"));
    await delivered("a", "1.0.0", new Date("2025-03-11T09:00:00Z"));
    await ctx.db
      .updateTable("device_events")
      .set({ channel_id: null })
      .where("created_at", "=", new Date("2025-03-11T09:00:00Z"))
      .execute();
    const body = await (
      await ctx.request(
        `/api/channels/${prodId}/activity?from=2025-03-01T00:00:00Z&to=2025-04-01T00:00:00Z`,
        { token: owner.token },
      )
    ).json();
    expect(body.totals.delivered).toBe(1);
    expect(body.series).toEqual([{ at: "2025-03-10", delivered: 1 }]);
    expect(
      (await ctx.request(`/api/channels/${prodId}/activity`, { token: owner.token })).status,
    ).toBe(400);
  });
});

describe("builds by channel", () => {
  it("lists only runs that deployed to the channel", async () => {
    const devId = (
      await ctx.db
        .selectFrom("channels")
        .select("id")
        .where("name", "=", "dev")
        .executeTakeFirstOrThrow()
    ).id;
    const parent = await ctx.db
      .insertInto("builds")
      .values({ app_id: appId, kind: "pipeline", status: "succeeded", source: "github" } as never)
      .returning("id")
      .executeTakeFirstOrThrow();
    await ctx.db
      .insertInto("builds")
      .values({
        app_id: appId,
        kind: "ota",
        status: "succeeded",
        source: "github",
        parent_id: parent.id,
        channel_id: prodId,
        channel_name: "prod",
      } as never)
      .execute();
    await ctx.db
      .insertInto("builds")
      .values({
        app_id: appId,
        kind: "ota",
        status: "succeeded",
        source: "cli",
        channel_id: devId,
        channel_name: "dev",
      } as never)
      .execute();
    const prod = await (
      await ctx.request(`/api/apps/${appId}/builds?scope=top&channel_id=${prodId}`, {
        token: owner.token,
      })
    ).json();
    expect(prod.map((row: { id: string }) => row.id)).toEqual([parent.id]);
  });
});
