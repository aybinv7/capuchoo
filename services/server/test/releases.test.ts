import { createHash } from "node:crypto";
import { generateReleaseKeyPair, signRelease } from "@capuchoo/core";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { createTestContext, fakeZip, seedApp, uploadForm, type TestContext } from "./harness";

let ctx: TestContext;
beforeEach(async () => {
  ctx = await createTestContext();
});
afterEach(async () => {
  await ctx.close();
});

async function sha256(blob: Blob): Promise<string> {
  return createHash("sha256")
    .update(Buffer.from(await blob.arrayBuffer()))
    .digest("hex");
}

describe("release signing", () => {
  it("accepts a correct signature, refuses a wrong one, and requires one when configured", async () => {
    const owner = await ctx.user("owner@acme.test");
    const { app } = await seedApp(ctx, owner.token);
    const keys = await generateReleaseKeyPair();
    const set = await ctx.request(`/api/apps/${app.id}/signing`, {
      method: "PUT",
      token: owner.token,
      json: { public_key: keys.publicKey, require_signature: true },
    });
    expect(set.status).toBe(200);
    expect((await set.json()).fingerprint).toMatch(/^[0-9a-f]{16}$/);

    const fields = {
      app_id: "com.acme.app",
      channel: "prod",
      platform: "android",
      flavour: "prod",
    };
    const unsigned = await ctx.request("/api/admin/upload", {
      method: "POST",
      token: owner.token,
      body: uploadForm({ ...fields, version_name: "1.0.0" }, fakeZip("a")),
    });
    expect(unsigned.status).toBe(403);
    expect((await unsigned.json()).reason).toBe("signature_required");

    const file = fakeZip("b");
    const good = await signRelease(
      {
        kind: "ota",
        appId: "com.acme.app",
        platform: "android",
        version: "1.0.0",
        sha256: await sha256(file),
      },
      keys.privateKey,
    );
    const forged = await signRelease(
      {
        kind: "ota",
        appId: "com.acme.app",
        platform: "android",
        version: "1.0.0",
        sha256: "0".repeat(64),
      },
      keys.privateKey,
    );

    const bad = await ctx.request("/api/admin/upload", {
      method: "POST",
      token: owner.token,
      body: uploadForm({ ...fields, version_name: "1.0.0", signature: forged }, file),
    });
    expect(bad.status).toBe(400);
    expect((await bad.json()).reason).toBe("bad_signature");

    const ok = await ctx.request("/api/admin/upload", {
      method: "POST",
      token: owner.token,
      body: uploadForm({ ...fields, version_name: "1.0.0", signature: good }, file),
    });
    expect(ok.status).toBe(201);

    const check = await (
      await ctx.request("/api/update", {
        method: "POST",
        json: {
          app_id: "com.acme.app",
          device_id: "d",
          platform: "android",
          defaultChannel: "prod",
          version_code: "1",
        },
      })
    ).json();
    expect(check.signature).toBe(good);
    expect(check.app_id).toBe("com.acme.app");
  });

  it("refuses a public key that is not P-256 SPKI", async () => {
    const owner = await ctx.user("owner@acme.test");
    const { app } = await seedApp(ctx, owner.token);
    const response = await ctx.request(`/api/apps/${app.id}/signing`, {
      method: "PUT",
      token: owner.token,
      json: { public_key: "not-a-key" },
    });
    expect(response.status).toBe(400);
  });
});

describe("native builds", () => {
  const nativeFields = (code: number, cert: string) => ({
    app_id: "com.acme.app",
    channel: "prod",
    platform: "android",
    flavour: "prod",
    version_name: `1.${code}.0`,
    version_code: String(code),
    signing_cert_sha256: cert,
  });

  it("refuse a signing-certificate change unless an admin allows it", async () => {
    const owner = await ctx.user("owner@acme.test");
    await seedApp(ctx, owner.token);
    const first = await ctx.request("/api/admin/native-upload", {
      method: "POST",
      token: owner.token,
      body: uploadForm(nativeFields(10, "a".repeat(64)), fakeZip("n10"), "app.apk"),
    });
    expect(first.status).toBe(201);
    expect((await first.json()).native).toMatchObject({
      version_code: 10,
      signing_cert_sha256: "a".repeat(64),
    });

    const changed = await ctx.request("/api/admin/native-upload", {
      method: "POST",
      token: owner.token,
      body: uploadForm(nativeFields(11, "b".repeat(64)), fakeZip("n11"), "app.apk"),
    });
    expect(changed.status).toBe(409);
    expect((await changed.json()).reason).toBe("certificate_changed");

    const allowed = await ctx.request("/api/admin/native-upload", {
      method: "POST",
      token: owner.token,
      body: uploadForm(
        { ...nativeFields(11, "b".repeat(64)), allow_cert_change: "true" },
        fakeZip("n11"),
        "app.apk",
      ),
    });
    expect(allowed.status).toBe(201);
  });

  it("offer a newer native with its checksum and never a native to a device that reports no build", async () => {
    const owner = await ctx.user("owner@acme.test");
    await seedApp(ctx, owner.token);
    await ctx.request("/api/admin/native-upload", {
      method: "POST",
      token: owner.token,
      body: uploadForm(nativeFields(12, "a".repeat(64)), fakeZip("n12"), "app.apk"),
    });
    const check = await (
      await ctx.request("/api/update", {
        method: "POST",
        json: {
          app_id: "com.acme.app",
          device_id: "d",
          platform: "android",
          defaultChannel: "prod",
          version_code: "11",
        },
      })
    ).json();
    expect(check.native_update).toMatchObject({ version_code: 12 });
    expect(check.native_update.download_url).toContain("/api/artefacts/");
  });

  it("refuse deleting a release a channel still serves", async () => {
    const owner = await ctx.user("owner@acme.test");
    await seedApp(ctx, owner.token);
    const upload = await (
      await ctx.request("/api/admin/native-upload", {
        method: "POST",
        token: owner.token,
        body: uploadForm(nativeFields(10, "a".repeat(64)), fakeZip("n"), "app.apk"),
      })
    ).json();
    const response = await ctx.request(`/api/natives/${upload.native.id}`, {
      method: "DELETE",
      token: owner.token,
    });
    expect(response.status).toBe(409);
    expect((await response.json()).reason).toBe("still_served");
  });
});

describe("builds and live events", () => {
  it("records a CLI build step by step and publishes it", async () => {
    const owner = await ctx.user("owner@acme.test");
    const { app } = await seedApp(ctx, owner.token);
    const seen: string[] = [];
    ctx.deps.hub.subscribe(app.id, (event) => seen.push(event.type));

    const build = await (
      await ctx.request(`/api/apps/${app.id}/builds`, {
        method: "POST",
        token: owner.token,
        json: {
          kind: "ota",
          channel: "prod",
          version: "1.0.0",
          source: "gitlab",
          commit: "abc123",
        },
      })
    ).json();
    expect(build).toMatchObject({ status: "running", flavour: "prod", source: "gitlab" });
    await ctx.request(`/api/builds/${build.id}/events`, {
      method: "POST",
      token: owner.token,
      json: { step: "web", status: "running", message: "vite build" },
    });
    await ctx.request(`/api/builds/${build.id}/events`, {
      method: "POST",
      token: owner.token,
      json: { step: "web", status: "succeeded" },
    });
    const finished = await (
      await ctx.request(`/api/builds/${build.id}/finish`, {
        method: "POST",
        token: owner.token,
        json: { status: "succeeded" },
      })
    ).json();
    expect(finished.status).toBe("succeeded");
    expect(
      (
        await ctx.request(`/api/builds/${build.id}/events`, {
          method: "POST",
          token: owner.token,
          json: { step: "late" },
        })
      ).status,
    ).toBe(409);

    const detail = await (
      await ctx.request(`/api/builds/${build.id}`, { token: owner.token })
    ).json();
    expect(
      detail.events.map(
        (event: { step: string; status: string }) => `${event.step}:${event.status}`,
      ),
    ).toEqual(["web:running", "web:succeeded"]);
    expect(seen).toEqual(["build", "build_event", "build_event", "build"]);
  });

  it("ingests GitLab pipeline and job hooks idempotently, and refuses a bad token", async () => {
    const owner = await ctx.user("owner@acme.test");
    const { app } = await seedApp(ctx, owner.token);
    const { token, webhook_url } = await (
      await ctx.request(`/api/apps/${app.id}/integrations/gitlab`, {
        method: "PUT",
        token: owner.token,
        json: {},
      })
    ).json();
    const path = new URL(webhook_url).pathname;

    const bad = await ctx.request(path, {
      method: "POST",
      headers: { "x-gitlab-token": "nope" },
      json: { object_kind: "pipeline" },
    });
    expect(bad.status).toBe(401);

    const pipeline = {
      object_kind: "pipeline",
      object_attributes: {
        id: 77,
        status: "running",
        ref: "main",
        sha: "deadbeef",
        url: "https://gitlab.example/p/77",
      },
    };
    await ctx.request(path, {
      method: "POST",
      headers: { "x-gitlab-token": token },
      json: pipeline,
    });
    await ctx.request(path, {
      method: "POST",
      headers: { "x-gitlab-token": token },
      json: {
        object_kind: "build",
        pipeline_id: 77,
        build_name: "publish:prod",
        build_status: "success",
        build_stage: "publish",
      },
    });
    await ctx.request(path, {
      method: "POST",
      headers: { "x-gitlab-token": token },
      json: {
        ...pipeline,
        object_attributes: { ...pipeline.object_attributes, status: "success" },
      },
    });

    const builds = await (
      await ctx.request(`/api/apps/${app.id}/builds`, { token: owner.token })
    ).json();
    expect(builds).toHaveLength(1);
    expect(builds[0]).toMatchObject({
      source: "gitlab",
      status: "succeeded",
      ref: "main",
      external_id: "77",
    });
    const detail = await (
      await ctx.request(`/api/builds/${builds[0].id}`, { token: owner.token })
    ).json();
    expect(detail.events[0]).toMatchObject({ step: "publish:prod", status: "succeeded" });
  });
});

describe("telemetry and statistics", () => {
  it("counts deliveries and failures per channel from plugin and runtime events", async () => {
    const owner = await ctx.user("owner@acme.test");
    const { app } = await seedApp(ctx, owner.token);
    await ctx.request("/api/admin/upload", {
      method: "POST",
      token: owner.token,
      body: uploadForm(
        {
          app_id: "com.acme.app",
          channel: "prod",
          version_name: "1.0.0",
          platform: "android",
          flavour: "prod",
        },
        fakeZip("s"),
      ),
    });
    const device = { app_id: "com.acme.app", platform: "android", defaultChannel: "prod" };
    await ctx.request("/api/update", { method: "POST", json: { ...device, device_id: "a" } });
    await ctx.request("/api/update", { method: "POST", json: { ...device, device_id: "b" } });
    const batch = await ctx.request("/api/stats", {
      method: "POST",
      json: [
        { ...device, device_id: "a", action: "set", version_name: "1.0.0" },
        { ...device, device_id: "b", action: "download_fail", version_name: "1.0.0" },
        { ...device, device_id: "c-unknown-app", app_id: "com.nobody", action: "set" },
      ],
    });
    expect(await batch.json()).toMatchObject({ received: 3, stored: 2 });
    await ctx.request("/api/native-updates/log", {
      method: "POST",
      json: {
        ...device,
        device_id: "a",
        event: "install",
        new_version: "1.1.0",
        new_version_code: 11,
      },
    });

    const stats = await (
      await ctx.request(`/api/apps/${app.id}/stats?days=7`, { token: owner.token })
    ).json();
    const prod = stats.channels.find((channel: { name: string }) => channel.name === "prod");
    expect(prod).toMatchObject({ devices: 2, installs_24h: 2, failures_24h: 1 });
    expect(stats.totals.devices).toBe(2);
  });

  it("drops an oversized body and rate-limits a looping device", async () => {
    const huge = "x".repeat(70 * 1024);
    const response = await ctx.request("/api/update", {
      method: "POST",
      json: { app_id: "a.b", device_id: "d", pad: huge },
    });
    expect(response.status).toBe(413);
    let limited = false;
    for (let attempt = 0; attempt < 40 && !limited; attempt += 1) {
      const check = await ctx.request("/api/update", {
        method: "POST",
        json: { app_id: "a.b.c", device_id: "loop", platform: "android" },
      });
      limited = check.status === 429;
    }
    expect(limited).toBe(true);
  });
});
