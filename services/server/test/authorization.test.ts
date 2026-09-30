import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { createTestContext, fakeZip, seedApp, uploadForm, type TestContext } from "./harness";

let ctx: TestContext;
beforeEach(async () => {
  ctx = await createTestContext();
});
afterEach(async () => {
  await ctx.close();
});

async function twoTenants() {
  const alice = await ctx.user("alice@acme.test");
  const mallory = await ctx.user("mallory@evil.test");
  const acme = await seedApp(ctx, alice.token, "com.acme.app");
  const evil = await seedApp(ctx, mallory.token, "com.evil.app");
  const upload = await ctx.request("/api/admin/upload", {
    method: "POST",
    token: alice.token,
    body: uploadForm(
      {
        app_id: "com.acme.app",
        channel: "prod",
        version_name: "1.0.0",
        platform: "android",
        flavour: "prod",
      },
      fakeZip("acme"),
    ),
  });
  const acmeBundle = (await upload.json()).bundle;
  const evilUpload = await ctx.request("/api/admin/upload", {
    method: "POST",
    token: mallory.token,
    body: uploadForm(
      {
        app_id: "com.evil.app",
        channel: "prod",
        version_name: "9.9.9",
        platform: "android",
        flavour: "prod",
      },
      fakeZip("evil"),
    ),
  });
  const evilBundle = (await evilUpload.json()).bundle;
  return { alice, mallory, acme, evil, acmeBundle, evilBundle };
}

describe("tenant isolation", () => {
  it("hides another tenant's app entirely (404, not 403)", async () => {
    const { mallory, acme } = await twoTenants();
    for (const path of [
      `/api/apps/${acme.app.id}`,
      `/api/apps/${acme.app.id}/channels`,
      `/api/apps/${acme.app.id}/devices`,
      `/api/apps/${acme.app.id}/artefacts`,
      `/api/apps/${acme.app.id}/stats`,
      `/api/apps/${acme.app.id}/events`,
      `/api/channels/${acme.channels.prod!.id}`,
      `/api/channels/${acme.channels.prod!.id}/history`,
    ]) {
      const response = await ctx.request(path, { token: mallory.token });
      expect(response.status, path).toBe(404);
    }
  });

  it("refuses pointing another tenant's channel at your bundle", async () => {
    const { mallory, acme, evilBundle } = await twoTenants();
    const response = await ctx.request(`/api/channels/${acme.channels.prod!.id}/point`, {
      method: "POST",
      token: mallory.token,
      json: { bundle_id: evilBundle.id },
    });
    expect(response.status).toBe(404);
  });

  it("refuses pointing your channel at another tenant's bundle", async () => {
    const { mallory, evil, acmeBundle } = await twoTenants();
    const response = await ctx.request(`/api/channels/${evil.channels.prod!.id}/point`, {
      method: "POST",
      token: mallory.token,
      json: { bundle_id: acmeBundle.id },
    });
    expect(response.status).toBe(404);
  });

  it("refuses editing, deleting or downloading another tenant's artefact", async () => {
    const { mallory, acmeBundle } = await twoTenants();
    expect(
      (
        await ctx.request(`/api/bundles/${acmeBundle.id}`, {
          method: "PATCH",
          token: mallory.token,
          json: { required: true },
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await ctx.request(`/api/bundles/${acmeBundle.id}`, {
          method: "DELETE",
          token: mallory.token,
        })
      ).status,
    ).toBe(404);
    expect(
      (await ctx.request(`/api/bundles/${acmeBundle.id}/download`, { token: mallory.token }))
        .status,
    ).toBe(404);
  });

  it("refuses uploading into another tenant's app", async () => {
    const { mallory } = await twoTenants();
    const response = await ctx.request("/api/admin/upload", {
      method: "POST",
      token: mallory.token,
      body: uploadForm(
        {
          app_id: "com.acme.app",
          channel: "prod",
          version_name: "6.6.6",
          platform: "android",
          flavour: "prod",
        },
        fakeZip("x"),
      ),
    });
    expect(response.status).toBe(404);
  });

  it("refuses creating channels, moving devices or reading members elsewhere", async () => {
    const { alice, mallory, acme } = await twoTenants();
    expect(
      (
        await ctx.request("/api/dashboard/channels", {
          method: "POST",
          token: mallory.token,
          json: { app_id: acme.app.id, name: "x", environment: "dev" },
        })
      ).status,
    ).toBe(404);
    expect(
      (await ctx.request(`/api/organizations/${acme.org.id}/members`, { token: mallory.token }))
        .status,
    ).toBe(404);

    await ctx.request("/api/update", {
      method: "POST",
      json: {
        app_id: "com.acme.app",
        device_id: "d1",
        platform: "android",
        defaultChannel: "prod",
      },
    });
    const devices = await (
      await ctx.request(`/api/apps/${acme.app.id}/devices`, { token: alice.token })
    ).json();
    const deviceId = devices.devices[0].id;
    expect(
      (await ctx.request(`/api/devices/${deviceId}`, { method: "DELETE", token: mallory.token }))
        .status,
    ).toBe(404);
    expect(
      (
        await ctx.request(`/api/devices/${deviceId}/channel`, {
          method: "PUT",
          token: mallory.token,
          json: { channel_id: null },
        })
      ).status,
    ).toBe(404);
  });

  it("lists only your own apps", async () => {
    const { mallory } = await twoTenants();
    const apps = await (await ctx.request("/api/apps", { token: mallory.token })).json();
    expect(apps.map((app: { app_id: string }) => app.app_id)).toEqual(["com.evil.app"]);
  });

  it("refuses registering another tenant's bundle id as your identifier or app", async () => {
    const { mallory, evil } = await twoTenants();
    expect(
      (
        await ctx.request(`/api/apps/${evil.app.id}/identifiers`, {
          method: "POST",
          token: mallory.token,
          json: { bundle_id: "com.acme.app" },
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await ctx.request("/api/apps", {
          method: "POST",
          token: mallory.token,
          json: { name: "x", app_id: "com.acme.app", organization_id: evil.org.id },
        })
      ).status,
    ).toBe(409);
  });
});

describe("roles inside one app", () => {
  it("lets a developer ship to dev but not to prod", async () => {
    const alice = await ctx.user("alice@acme.test");
    const dev = await ctx.user("dev@acme.test");
    const { app } = await seedApp(ctx, alice.token);
    await ctx.request(`/api/apps/${app.id}/permissions`, {
      method: "POST",
      token: alice.token,
      json: { email: dev.email, role: "developer" },
    });

    const toDev = await ctx.request("/api/admin/upload", {
      method: "POST",
      token: dev.token,
      body: uploadForm(
        {
          app_id: "com.acme.app",
          channel: "dev",
          version_name: "0.1.0",
          platform: "android",
          flavour: "dev",
        },
        fakeZip("d"),
      ),
    });
    expect(toDev.status).toBe(201);

    const toProd = await ctx.request("/api/admin/upload", {
      method: "POST",
      token: dev.token,
      body: uploadForm(
        {
          app_id: "com.acme.app",
          channel: "prod",
          version_name: "0.1.0",
          platform: "android",
          flavour: "prod",
        },
        fakeZip("p"),
      ),
    });
    expect(toProd.status).toBe(403);
  });

  it("lets a viewer read but not deliver, edit or grant", async () => {
    const alice = await ctx.user("alice@acme.test");
    const viewer = await ctx.user("viewer@acme.test");
    const { app, channels } = await seedApp(ctx, alice.token);
    await ctx.request(`/api/apps/${app.id}/permissions`, {
      method: "POST",
      token: alice.token,
      json: { email: viewer.email, role: "viewer" },
    });
    expect(
      (await ctx.request(`/api/apps/${app.id}/channels`, { token: viewer.token })).status,
    ).toBe(200);
    expect(
      (
        await ctx.request(`/api/channels/${channels.prod!.id}/pause`, {
          method: "POST",
          token: viewer.token,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await ctx.request(`/api/channels/${channels.prod!.id}`, {
          method: "PUT",
          token: viewer.token,
          json: { allow_dev: false },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await ctx.request(`/api/apps/${app.id}/permissions`, {
          method: "POST",
          token: viewer.token,
          json: { email: viewer.email, role: "admin" },
        })
      ).status,
    ).toBe(403);
  });

  it("never lets a channel pointer be edited directly", async () => {
    const alice = await ctx.user("alice@acme.test");
    const { channels } = await seedApp(ctx, alice.token);
    const response = await ctx.request(`/api/channels/${channels.prod!.id}`, {
      method: "PUT",
      token: alice.token,
      json: { current_version_id: "00000000-0000-0000-0000-000000000000" },
    });
    expect(response.status).toBe(400);
    expect((await response.json()).reason).toBe("use_delivery_actions");
  });

  it("locks a channel's environment once it has served", async () => {
    const alice = await ctx.user("alice@acme.test");
    const { channels } = await seedApp(ctx, alice.token);
    expect(
      (
        await ctx.request(`/api/channels/${channels.dev!.id}`, {
          method: "PUT",
          token: alice.token,
          json: { environment: "staging" },
        })
      ).status,
    ).toBe(200);
    await ctx.request("/api/admin/upload", {
      method: "POST",
      token: alice.token,
      body: uploadForm(
        {
          app_id: "com.acme.app",
          channel: "prod",
          version_name: "1.0.0",
          platform: "android",
          flavour: "prod",
        },
        fakeZip("p"),
      ),
    });
    const locked = await ctx.request(`/api/channels/${channels.prod!.id}`, {
      method: "PUT",
      token: alice.token,
      json: { environment: "dev" },
    });
    expect(locked.status).toBe(409);
    expect((await locked.json()).reason).toBe("environment_locked");
  });
});

describe("API keys", () => {
  it("honour an app restriction on every route", async () => {
    const alice = await ctx.user("alice@acme.test");
    const one = await seedApp(ctx, alice.token, "com.acme.one");
    const two = await seedApp(ctx, alice.token, "com.acme.two");
    const key = await ctx.key(alice.id, { appId: one.app.id });
    expect((await ctx.request(`/api/apps/${one.app.id}/channels`, { token: key })).status).toBe(
      200,
    );
    expect((await ctx.request(`/api/apps/${two.app.id}/channels`, { token: key })).status).toBe(
      404,
    );
    const apps = await (await ctx.request("/api/apps", { token: key })).json();
    expect(apps).toHaveLength(1);
    expect(
      (
        await ctx.request(`/api/organizations/${one.org.id}/members`, {
          method: "POST",
          token: key,
          json: { email: "x@y.z", role: "admin" },
        })
      ).status,
    ).toBe(403);
  });

  it("honour a role cap: a viewer-capped key of an owner cannot delete the app", async () => {
    const alice = await ctx.user("alice@acme.test");
    const { app } = await seedApp(ctx, alice.token);
    const key = await ctx.key(alice.id, { role: "viewer" });
    expect(
      (await ctx.request(`/api/apps/${app.id}`, { method: "DELETE", token: key })).status,
    ).toBe(403);
    expect((await ctx.request(`/api/apps/${app.id}`, { token: key })).status).toBe(200);
  });

  it("cannot mint a stronger key than the one used", async () => {
    const alice = await ctx.user("alice@acme.test");
    await seedApp(ctx, alice.token);
    const capped = await ctx.key(alice.id, { role: "developer" });
    expect(
      (await ctx.request("/api/api-keys", { method: "POST", token: capped, json: { name: "x" } }))
        .status,
    ).toBe(403);
    expect(
      (
        await ctx.request("/api/api-keys", {
          method: "POST",
          token: capped,
          json: { name: "x", role: "admin" },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await ctx.request("/api/api-keys", {
          method: "POST",
          token: capped,
          json: { name: "x", role: "tester" },
        })
      ).status,
    ).toBe(201);
  });

  it("stop working once revoked", async () => {
    const alice = await ctx.user("alice@acme.test");
    const created = await (
      await ctx.request("/api/api-keys", {
        method: "POST",
        token: alice.token,
        json: { name: "ci" },
      })
    ).json();
    expect((await ctx.request("/api/auth/me", { token: created.key })).status).toBe(200);
    expect(
      (await ctx.request(`/api/api-keys/${created.id}`, { method: "DELETE", token: alice.token }))
        .status,
    ).toBe(204);
    expect((await ctx.request("/api/auth/me", { token: created.key })).status).toBe(401);
  });
});

describe("organization roles", () => {
  it("stops an admin promoting anyone to owner, and keeps the last owner", async () => {
    const alice = await ctx.user("alice@acme.test");
    const bob = await ctx.user("bob@acme.test");
    const { org } = await seedApp(ctx, alice.token);
    await ctx.request(`/api/organizations/${org.id}/members`, {
      method: "POST",
      token: alice.token,
      json: { email: bob.email, role: "admin" },
    });
    expect(
      (
        await ctx.request(`/api/organizations/${org.id}/members/${bob.id}`, {
          method: "PUT",
          token: bob.token,
          json: { role: "owner" },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await ctx.request(`/api/organizations/${org.id}/members/${alice.id}`, {
          method: "DELETE",
          token: bob.token,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await ctx.request(`/api/organizations/${org.id}/members/${alice.id}`, {
          method: "PUT",
          token: alice.token,
          json: { role: "admin" },
        })
      ).status,
    ).toBe(409);
  });

  it("invites unknown emails instead of creating accounts, and the invite signs them in", async () => {
    const alice = await ctx.user("alice@acme.test");
    const { org } = await seedApp(ctx, alice.token);
    const invite = await (
      await ctx.request(`/api/organizations/${org.id}/members`, {
        method: "POST",
        token: alice.token,
        json: { email: "new@acme.test", role: "member" },
      })
    ).json();
    expect(invite.invitation.url).toContain("/invite/");
    const accepted = await ctx.request("/api/auth/invitations/accept", {
      method: "POST",
      json: { token: invite.invitation.token, password: "a long enough passphrase" },
    });
    expect(accepted.status).toBe(200);
    const { token } = await accepted.json();
    const me = await (await ctx.request("/api/auth/me", { token })).json();
    expect(me.organizations[0]).toMatchObject({ id: org.id, role: "member" });
  });
});

describe("sessions", () => {
  it("sign in, reject a wrong password with the same message as an unknown email, sign out", async () => {
    await ctx.user("alice@acme.test");
    const wrong = await ctx.request("/api/auth/login", {
      method: "POST",
      json: { email: "alice@acme.test", password: "nope nope nope" },
    });
    const unknown = await ctx.request("/api/auth/login", {
      method: "POST",
      json: { email: "ghost@acme.test", password: "nope nope nope" },
    });
    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toEqual(await unknown.json());

    const ok = await ctx.request("/api/auth/login", {
      method: "POST",
      json: { email: "ALICE@acme.test", password: "correct horse battery staple" },
    });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("set-cookie")).toMatch(/capuchoo_session=cps_.+HttpOnly/i);
    const { token } = await ok.json();
    await ctx.request("/api/auth/logout", { method: "POST", token });
    expect((await ctx.request("/api/auth/me", { token })).status).toBe(401);
  });

  it("refuses a cookie-authenticated write from another origin", async () => {
    const alice = await ctx.user("alice@acme.test");
    const response = await ctx.request("/api/organizations", {
      method: "POST",
      headers: {
        cookie: `capuchoo_session=${alice.token}`,
        origin: "https://evil.example",
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "x" }),
    });
    expect(response.status).toBe(403);
    expect((await response.json()).reason).toBe("csrf");
  });

  it("keeps sign-up closed by default", async () => {
    const response = await ctx.request("/api/auth/register", {
      method: "POST",
      json: { email: "a@b.co", password: "a long enough passphrase" },
    });
    expect(response.status).toBe(403);
  });
});
