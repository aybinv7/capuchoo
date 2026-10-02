import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { createTestContext, fakeZip, seedApp, uploadForm, type TestContext } from "./harness";

let ctx: TestContext;
beforeEach(async () => {
  ctx = await createTestContext();
});
afterEach(async () => {
  await ctx.close();
});

async function publish(
  token: string,
  fields: Record<string, string>,
  seed = fields.version_name ?? "x",
) {
  return ctx.request("/api/admin/upload", {
    method: "POST",
    token,
    body: uploadForm(
      {
        platform: "android",
        flavour: fields.channel === "prod" ? "prod" : (fields.flavour ?? fields.channel ?? "dev"),
        ...fields,
      },
      fakeZip(seed),
    ),
  });
}

function check(body: Record<string, unknown>) {
  return ctx.request("/api/update", {
    method: "POST",
    json: {
      app_id: "com.acme.app",
      device_id: "tablet-1",
      platform: "android",
      version_name: "builtin",
      version_code: "10",
      ...body,
    },
  });
}

describe("publish → check → download", () => {
  it("serves a published bundle with a signed, resumable link", async () => {
    const owner = await ctx.user("owner@acme.test");
    await seedApp(ctx, owner.token);

    const upload = await publish(owner.token, {
      app_id: "com.acme.app",
      channel: "prod",
      version_name: "1.0.0",
    });
    expect(upload.status).toBe(201);

    const response = await check({ defaultChannel: "prod" });
    const body = await response.json();
    expect(body.version).toBe("1.0.0");
    expect(body.url).toMatch(/\/api\/artefacts\/apps\/.+\.zip\?exp=\d+&sig=[0-9a-f]{64}$/);
    expect(body.checksum).toMatch(/^[0-9a-f]{64}$/);

    const path = new URL(body.url).pathname + new URL(body.url).search;
    const full = await ctx.request(path);
    expect(full.status).toBe(200);
    const bytes = new Uint8Array(await full.arrayBuffer());
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);

    const partial = await ctx.request(path, { headers: { range: "bytes=4-9" } });
    expect(partial.status).toBe(206);
    expect(partial.headers.get("content-range")).toBe(`bytes 4-9/${bytes.length}`);
    expect(new TextDecoder().decode(await partial.arrayBuffer())).toBe("1.0.0-");

    const tampered = await ctx.request(
      path.replace(/sig=([0-9a-f])/, (_, digit: string) => `sig=${digit === "0" ? "1" : "0"}`),
    );
    expect(tampered.status).toBe(403);
  });

  it("records the device and the check", async () => {
    const owner = await ctx.user("owner@acme.test");
    const { app } = await seedApp(ctx, owner.token);
    await publish(owner.token, { app_id: "com.acme.app", channel: "prod", version_name: "1.0.0" });
    await check({ defaultChannel: "prod", model: "SM-X236B" });

    const devices = await (
      await ctx.request(`/api/apps/${app.id}/devices`, { token: owner.token })
    ).json();
    expect(devices.total).toBe(1);
    expect(devices.devices[0]).toMatchObject({
      device_id: "tablet-1",
      model: "SM-X236B",
      channel_name: "prod",
    });
  });

  it("refuses a bundle built from another flavour", async () => {
    const owner = await ctx.user("owner@acme.test");
    await seedApp(ctx, owner.token);
    const response = await publish(owner.token, {
      app_id: "com.acme.app",
      channel: "prod",
      version_name: "1.0.0",
      flavour: "staging",
    });
    expect(response.status).toBe(409);
    expect((await response.json()).reason).toBe("flavour-mismatch");
  });

  it("refuses an upload with no flavour and one that is not a zip", async () => {
    const owner = await ctx.user("owner@acme.test");
    await seedApp(ctx, owner.token);
    const form = new FormData();
    for (const [key, value] of Object.entries({
      app_id: "com.acme.app",
      channel: "prod",
      version_name: "1.0.0",
      platform: "android",
    }))
      form.append(key, value);
    form.append("bundle", fakeZip("a"), "b.zip");
    expect(
      (await ctx.request("/api/admin/upload", { method: "POST", token: owner.token, body: form }))
        .status,
    ).toBe(400);

    const notZip = uploadForm(
      {
        app_id: "com.acme.app",
        channel: "prod",
        version_name: "1.0.0",
        platform: "android",
        flavour: "prod",
      },
      new Blob(["hello"]),
    );
    const response = await ctx.request("/api/admin/upload", {
      method: "POST",
      token: owner.token,
      body: notZip,
    });
    expect(response.status).toBe(400);
    expect((await response.json()).reason).toBe("not_zip");
  });

  it("refuses to publish an older version without a rollback", async () => {
    const owner = await ctx.user("owner@acme.test");
    await seedApp(ctx, owner.token);
    await publish(owner.token, { app_id: "com.acme.app", channel: "prod", version_name: "1.2.0" });
    const older = await publish(owner.token, {
      app_id: "com.acme.app",
      channel: "prod",
      version_name: "1.1.0",
    });
    expect(older.status).toBe(409);
    expect((await older.json()).reason).toBe("downgrade-needs-rollback");
  });
});

describe("client channels", () => {
  it("deliver only what the release channel served, then pin and roll back", async () => {
    const owner = await ctx.user("owner@acme.test");
    const { app } = await seedApp(ctx, owner.token);
    const client = await (
      await ctx.request("/api/dashboard/channels", {
        method: "POST",
        token: owner.token,
        json: { app_id: app.id, name: "prod-acme", kind: "client", base: "prod" },
      })
    ).json();
    expect(client).toMatchObject({ kind: "client", environment: "prod" });

    const stagedOnly = await publish(owner.token, {
      app_id: "com.acme.app",
      channel: "prod",
      version_name: "1.0.0",
      active: "false",
    });
    expect(stagedOnly.status).toBe(201);
    const refused = await ctx.request(`/api/channels/${client.id}/point`, {
      method: "POST",
      token: owner.token,
      json: { version: "1.0.0" },
    });
    expect(refused.status).toBe(409);
    expect((await refused.json()).reason).toBe("not-on-base");

    await publish(owner.token, { app_id: "com.acme.app", channel: "prod", version_name: "1.1.0" });
    await publish(owner.token, { app_id: "com.acme.app", channel: "prod", version_name: "1.2.0" });
    expect(
      (
        await ctx.request(`/api/channels/${client.id}/point`, {
          method: "POST",
          token: owner.token,
          json: { version: "1.2.0" },
        })
      ).status,
    ).toBe(200);

    const device = { defaultChannel: "prod-acme", version_name: "1.2.0" };
    expect((await (await check(device)).json()).message).toBe("No update available");

    const noRollback = await ctx.request(`/api/channels/${client.id}/point`, {
      method: "POST",
      token: owner.token,
      json: { version: "1.1.0" },
    });
    expect(noRollback.status).toBe(409);
    const rollback = await ctx.request(`/api/channels/${client.id}/point`, {
      method: "POST",
      token: owner.token,
      json: { version: "1.1.0", rollback: true, reason: "crash" },
    });
    expect(rollback.status).toBe(200);
    expect((await rollback.json()).allow_downgrade).toBe(true);

    const history = await (
      await ctx.request(`/api/channels/${client.id}/history`, { token: owner.token })
    ).json();
    expect(history[0]).toMatchObject({
      action: "rollback_bundle",
      from_version: "1.2.0",
      to_version: "1.1.0",
      reason: "crash",
      actor_email: "owner@acme.test",
    });
  });

  it("refuse uploads directly", async () => {
    const owner = await ctx.user("owner@acme.test");
    const { app } = await seedApp(ctx, owner.token);
    await ctx.request("/api/dashboard/channels", {
      method: "POST",
      token: owner.token,
      json: { app_id: app.id, name: "prod-acme", kind: "client", base: "prod" },
    });
    const response = await publish(owner.token, {
      app_id: "com.acme.app",
      channel: "prod-acme",
      version_name: "1.0.0",
      flavour: "prod",
    });
    expect(response.status).toBe(409);
    expect((await response.json()).reason).toBe("client_channel_upload");
  });

  it("serve a device assigned from the dashboard, not the channel its build reports", async () => {
    const owner = await ctx.user("owner@acme.test");
    const { app } = await seedApp(ctx, owner.token);
    const client = await (
      await ctx.request("/api/dashboard/channels", {
        method: "POST",
        token: owner.token,
        json: { app_id: app.id, name: "prod-acme", kind: "client", base: "prod" },
      })
    ).json();
    await publish(owner.token, { app_id: "com.acme.app", channel: "prod", version_name: "1.0.0" });
    await publish(owner.token, { app_id: "com.acme.app", channel: "prod", version_name: "2.0.0" });
    await ctx
      .request(`/api/channels/${client.id}/point`, {
        method: "POST",
        token: owner.token,
        json: { version: "1.0.0", rollback: false },
      })
      .catch(() => undefined);

    await check({ defaultChannel: "prod" });
    const devices = await (
      await ctx.request(`/api/apps/${app.id}/devices`, { token: owner.token })
    ).json();
    await ctx.request(`/api/devices/${devices.devices[0].id}/channel`, {
      method: "PUT",
      token: owner.token,
      json: { channel_id: client.id },
    });

    const body = await (await check({ defaultChannel: "prod" })).json();
    expect(body.version).toBe("1.0.0");
  });
});

describe("pause", () => {
  it("stops a channel serving until resumed", async () => {
    const owner = await ctx.user("owner@acme.test");
    const { channels } = await seedApp(ctx, owner.token);
    await publish(owner.token, { app_id: "com.acme.app", channel: "prod", version_name: "1.0.0" });
    await ctx.request(`/api/channels/${channels.prod!.id}/pause`, {
      method: "POST",
      token: owner.token,
      json: { reason: "incident" },
    });
    const paused = await (await check({ defaultChannel: "prod" })).json();
    expect(paused.url).toBeUndefined();
    await ctx.request(`/api/channels/${channels.prod!.id}/resume`, {
      method: "POST",
      token: owner.token,
    });
    expect((await (await check({ defaultChannel: "prod" })).json()).version).toBe("1.0.0");
  });
});
