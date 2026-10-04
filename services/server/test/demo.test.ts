import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { createTestContext, type TestContext } from "./harness";

describe("demo organization", () => {
  let ctx: TestContext;
  let admin: { id: string; token: string };

  beforeAll(async () => {
    ctx = await createTestContext({ DEMO_SEED: "enabled" });
    admin = await ctx.user("admin@capuchoo.test", { admin: true });
  }, 60_000);
  afterAll(() => ctx.close());

  it("is refused to anyone but an instance admin", async () => {
    const member = await ctx.user("member@capuchoo.test");
    const response = await ctx.request("/api/admin/demo", { method: "POST", token: member.token });
    expect(response.status).toBe(403);
  });

  it("seeds two apps with runs, jobs, logs, devices and a story to tell, twice in a row", async () => {
    for (let pass = 0; pass < 2; pass += 1) {
      const response = await ctx.request("/api/admin/demo", { method: "POST", token: admin.token });
      expect(response.status).toBe(201);
    }
    const summary = await (await ctx.request("/api/admin/demo", { token: admin.token })).json();
    expect(summary).toMatchObject({
      enabled: true,
      organization: { name: "Northwind Distribution" },
    });

    const apps = await ctx.db
      .selectFrom("apps")
      .select(["id", "name"])
      .where("organization_id", "=", summary.organization.id)
      .execute();
    expect(apps.map((app) => app.name).sort()).toEqual([
      "Northwind Delivery",
      "Northwind Field Sales",
    ]);
    const fieldSales = apps.find((app) => app.name === "Northwind Field Sales")!;

    const runs = await (
      await ctx.request(`/api/apps/${fieldSales.id}/builds?scope=top&limit=50`, {
        token: admin.token,
      })
    ).json();
    expect(runs.length).toBeGreaterThanOrEqual(15);
    const statuses = new Set(runs.map((run: { status: string }) => run.status));
    for (const status of ["running", "succeeded", "failed", "cancelled"])
      expect(statuses).toContain(status);
    const tagged = runs.find((run: { title: string }) => run.title === "v1.9.1");
    expect(tagged.target_channel_ids).toHaveLength(1);

    const waiting = runs.find(
      (run: { title: string }) => run.title === "Deliver to prod-fabrikam @ 1.9.1",
    );
    const waitingDetail = await (
      await ctx.request(`/api/builds/${waiting.id}`, { token: admin.token })
    ).json();
    expect(
      waitingDetail.jobs.find((job: { plan_key: string }) => job.plan_key === "deliver").status,
    ).toBe("waiting");

    const detail = await (
      await ctx.request(`/api/builds/${tagged.id}`, { token: admin.token })
    ).json();
    expect(detail.plan.jobs.map((job: { key: string }) => job.key)).toEqual([
      "plan",
      "check",
      "publish-ota",
      "publish-native",
      "deliver",
    ]);
    expect(detail.children[0]).toMatchObject({
      job_key: "publish-ota",
      channel_name: "prod",
      status: "succeeded",
    });
    const publish = detail.jobs.find((job: { plan_key: string }) => job.plan_key === "publish-ota");
    const logs = await (
      await ctx.request(`/api/builds/${tagged.id}/jobs/${publish.id}/logs`, { token: admin.token })
    ).json();
    expect(logs.available).toBe(true);
    const publishStep = logs.steps.find(
      (entry: { name: string }) => entry.name === "Publish the OTA bundle",
    );
    expect(publishStep.lines[0]).toMatchObject({ kind: "group" });
    expect(
      publishStep.lines.some((line: { text: string }) => line.text.includes("Published OTA 1.9.1")),
    ).toBe(true);

    const crashes = await ctx.db
      .selectFrom("device_events")
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .where("app_id", "=", fieldSales.id)
      .where("action", "=", "update_fail")
      .executeTakeFirstOrThrow();
    expect(Number(crashes.count)).toBeGreaterThan(0);

    const paused = await ctx.db
      .selectFrom("channels")
      .select(["name", "paused"])
      .where("app_id", "=", fieldSales.id)
      .where("paused", "=", true)
      .execute();
    expect(paused.map((channel) => channel.name)).toEqual(["prod-tailspin"]);

    const prod = await ctx.db
      .selectFrom("channels")
      .select("id")
      .where("app_id", "=", fieldSales.id)
      .where("name", "=", "prod")
      .executeTakeFirstOrThrow();
    const rollout = await (
      await ctx.request(`/api/channels/${prod.id}/rollout`, { token: admin.token })
    ).json();
    expect(rollout.on_current).toBeGreaterThan(0);
    expect(rollout.curve.at(-1)?.devices ?? 0).toBeLessThanOrEqual(rollout.on_current);
    const attributed = await ctx.db
      .selectFrom("devices")
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .where("app_id", "=", fieldSales.id)
      .where("attributes", "is not", null)
      .executeTakeFirstOrThrow();
    expect(Number(attributed.count)).toBeGreaterThan(0);

    const recording = await (
      await ctx.request(`/api/apps/${fieldSales.id}/recording-stats?days=14`, {
        token: admin.token,
      })
    ).json();
    expect(recording.totals.sessions).toBeGreaterThan(50);
    expect(recording.totals.reports).toBeGreaterThan(0);
    expect(recording.issues.regressed).toBeGreaterThan(0);
    expect(recording.recorders.total).toBeGreaterThan(0);
    const listed = await (
      await ctx.request(`/api/apps/${fieldSales.id}/recordings?limit=5`, { token: admin.token })
    ).json();
    expect(listed.sessions).toHaveLength(5);
  }, 120_000);
});

describe("demo organization, disabled", () => {
  it("is refused when the operator has not turned it on", async () => {
    const ctx = await createTestContext();
    try {
      const admin = await ctx.user("admin@capuchoo.test", { admin: true });
      const response = await ctx.request("/api/admin/demo", { method: "POST", token: admin.token });
      expect(response.status).toBe(403);
    } finally {
      await ctx.close();
    }
  });
});
