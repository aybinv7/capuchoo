import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { BackgroundTasks } from "../src/lib/background";
import { LoadGuard } from "../src/lib/load-guard";
import { createTestContext, seedApp, type TestContext } from "./harness";

const silent = { debug() {}, info() {}, warn() {}, error() {} };

describe("LoadGuard", () => {
  it("refuses past its cap with a jittered retry, and frees the slot when work ends", async () => {
    const guard = new LoadGuard(1, () => 0.99);
    let release!: () => void;
    const held = guard.run(() => new Promise<void>((resolve) => (release = resolve)));

    await expect(guard.run(async () => "second")).rejects.toMatchObject({
      status: 503,
      reason: "busy",
      details: { retry_after: 5 },
    });
    expect(guard.shed).toBe(1);

    release();
    await held;
    await expect(guard.run(async () => "third")).resolves.toBe("third");
    expect(guard.inflight).toBe(0);
  });

  it("frees the slot when the work throws", async () => {
    const guard = new LoadGuard(1);
    await expect(guard.run(() => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    expect(guard.inflight).toBe(0);
  });
});

describe("BackgroundTasks", () => {
  it("drops only droppable work past its limit", async () => {
    const tasks = new BackgroundTasks(silent as never, 1);
    let release!: () => void;
    tasks.run("slow", () => new Promise<void>((resolve) => (release = resolve)));
    let ran = 0;
    tasks.run("telemetry", async () => void ran++, { droppable: true });
    tasks.run("cleanup", async () => void ran++);

    expect(tasks.dropped).toBe(1);
    release();
    await tasks.idle();
    expect(ran).toBe(1);
  });
});

describe("device routes under load", () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
    const owner = await ctx.user("owner@acme.test");
    await seedApp(ctx, owner.token);
  });
  afterEach(async () => {
    await ctx.close();
  });

  it("answer 503 with Retry-After instead of queueing, and recover", async () => {
    const check = () =>
      ctx.request("/api/update", {
        method: "POST",
        json: { app_id: "com.acme.app", device_id: "d1", platform: "android" },
      });
    const saturated = new LoadGuard(0);
    const normal = ctx.deps.load;
    ctx.deps.load = saturated;

    const refused = await check();
    expect(refused.status).toBe(503);
    expect(Number(refused.headers.get("retry-after"))).toBeGreaterThanOrEqual(2);
    expect((await refused.json()).reason).toBe("busy");

    ctx.deps.load = normal;
    expect((await check()).status).toBe(200);
  });
});
