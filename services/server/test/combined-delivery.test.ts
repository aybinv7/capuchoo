import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { createTestContext, fakeZip, seedApp, uploadForm, type TestContext } from "./harness";

let ctx: TestContext;
beforeEach(async () => {
  ctx = await createTestContext();
});
afterEach(async () => {
  await ctx.close();
});

async function setup() {
  const owner = await ctx.user("owner@acme.test");
  const { app } = await seedApp(ctx, owner.token);
  const client = await (
    await ctx.request("/api/dashboard/channels", {
      method: "POST",
      token: owner.token,
      json: { app_id: app.id, name: "prod-acme", kind: "client", base: "prod" },
    })
  ).json();
  const base = { app_id: "com.acme.app", channel: "prod", platform: "android", flavour: "prod" };
  const native = await (
    await ctx.request("/api/admin/native-upload", {
      method: "POST",
      token: owner.token,
      body: uploadForm(
        { ...base, version_name: "2.0.0", version_code: "20" },
        fakeZip("n20"),
        "app.apk",
      ),
    })
  ).json();
  const bundle = await (
    await ctx.request("/api/admin/upload", {
      method: "POST",
      token: owner.token,
      body: uploadForm({ ...base, version_name: "2.0.0", min_update_version: "20" }, fakeZip("b2")),
    })
  ).json();
  return { owner, client, native: native.native, bundle: bundle.bundle };
}

describe("delivering a bundle and a native build together", () => {
  it("moves both pointers, native first, so a gated bundle is accepted", async () => {
    const { owner, client, native, bundle } = await setup();
    const response = await ctx.request(`/api/channels/${client.id}/point`, {
      method: "POST",
      token: owner.token,
      json: { bundle_id: bundle.id, native_id: native.id, reason: "together" },
    });
    expect(response.status).toBe(200);
    const channel = await response.json();
    expect(channel.current_bundle_id).toBe(bundle.id);
    expect(channel.current_native_id).toBe(native.id);

    const history = await (
      await ctx.request(`/api/channels/${client.id}/history`, { token: owner.token })
    ).json();
    expect(history.map((row: { action: string }) => row.action).sort()).toEqual([
      "point_bundle",
      "point_native",
    ]);
  });

  it("refuses the gated bundle alone, and moves nothing when one half is refused", async () => {
    const { owner, client, bundle } = await setup();
    const alone = await ctx.request(`/api/channels/${client.id}/point`, {
      method: "POST",
      token: owner.token,
      json: { bundle_id: bundle.id },
    });
    expect(alone.status).toBe(409);
    expect((await alone.json()).reason).toBe("native-gate");

    const detail = await (
      await ctx.request(`/api/channels/${client.id}`, { token: owner.token })
    ).json();
    expect(detail.current_bundle_id).toBeNull();
    expect(detail.current_native_id).toBeNull();
  });

  it("serves the required native to a device on an older build", async () => {
    const { owner, client, native, bundle } = await setup();
    await ctx.request(`/api/natives/${native.id}`, {
      method: "PATCH",
      token: owner.token,
      json: { required: true },
    });
    await ctx.request(`/api/channels/${client.id}/point`, {
      method: "POST",
      token: owner.token,
      json: { bundle_id: bundle.id, native_id: native.id },
    });
    const check = await (
      await ctx.request("/api/update", {
        method: "POST",
        json: {
          app_id: "com.acme.app",
          device_id: "t1",
          platform: "android",
          version_name: "builtin",
          version_code: "10",
          defaultChannel: "prod-acme",
        },
      })
    ).json();
    expect(check.native_update).toMatchObject({ version_code: 20, required: true });
    expect(check.native_update.checksum).toMatch(/^[0-9a-f]{64}$/);
  });
});
