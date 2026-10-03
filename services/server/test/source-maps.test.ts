import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { runRetention } from "../src/services/retention";
import { createTestContext, seedApp, type TestContext } from "./harness";

let ctx: TestContext;
let owner: { id: string; token: string };
let appId: string;

const MAP = JSON.stringify({
  version: 3,
  sources: ["src/main.ts"],
  names: [],
  mappings: "AAAA",
});

beforeEach(async () => {
  ctx = await createTestContext();
  owner = await ctx.user("owner@acme.test");
  appId = (await seedApp(ctx, owner.token)).app.id;
});
afterEach(async () => {
  await ctx.close();
});

function upload(path: string, body: string, token = owner.token, version = "3.0.1") {
  return ctx.request(
    `/api/apps/${appId}/source-maps?version=${encodeURIComponent(version)}&path=${encodeURIComponent(path)}`,
    { method: "PUT", token, body, headers: { "content-type": "application/json" } },
  );
}

describe("source maps", () => {
  it("are stored per version and path, listed, served back and replaced in place", async () => {
    expect((await upload("assets/index-abc.js.map", MAP)).status).toBe(201);
    expect((await upload("./assets/vendor-def.js.map", MAP)).status).toBe(201);
    expect((await upload("assets/index-abc.js.map", MAP.replace("AAAA", "AACA"))).status).toBe(200);

    const listed = await (
      await ctx.request(`/api/apps/${appId}/source-maps?version=3.0.1`, { token: owner.token })
    ).json();
    expect(listed.maps.map((map: { path: string }) => map.path)).toEqual([
      "assets/index-abc.js.map",
      "assets/vendor-def.js.map",
    ]);

    const served = await ctx.request(
      `/api/apps/${appId}/source-maps/file?version=3.0.1&path=assets/index-abc.js.map`,
      { token: owner.token },
    );
    expect(served.status).toBe(200);
    expect((await served.json()).mappings).toBe("AACA");
  });

  it("refuses a path outside the bundle, a body that is not JSON, and other apps' viewers", async () => {
    expect((await upload("../secrets.map", MAP)).status).toBe(400);
    expect((await upload("assets/index.js", MAP)).status).toBe(400);
    expect((await upload("assets/index.js.map", "not json")).status).toBe(400);

    const stranger = await ctx.user("stranger@other.test");
    expect((await upload("assets/index.js.map", MAP, stranger.token)).status).toBe(404);
    expect(
      (
        await ctx.request(
          `/api/apps/${appId}/source-maps/file?version=3.0.1&path=assets/missing.js.map`,
          { token: owner.token },
        )
      ).status,
    ).toBe(404);
  });

  it("expire with retention once no recording runs their version", async () => {
    await upload("assets/index.js.map", MAP);
    const count = async () =>
      (await ctx.deps.db.selectFrom("source_maps").select("id").execute()).length;
    await runRetention(ctx.deps);
    expect(await count()).toBe(1);

    ctx.deps.now = () => new Date(Date.now() + 400 * 86_400_000);
    await runRetention(ctx.deps);
    expect(await count()).toBe(0);
  });
});
