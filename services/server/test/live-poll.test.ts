import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { EventBacklog } from "../src/services/event-backlog";
import type { HubEvent } from "../src/services/event-hub";
import { createTestContext, seedApp, type TestContext } from "./harness";

const event = (appId: string, n: number): HubEvent => ({ type: "build", appId, data: { n } });

describe("event backlog", () => {
  it("returns an app's events after a cursor and ignores other apps", () => {
    const backlog = new EventBacklog();
    const start = backlog.cursor;
    backlog.record(event("a", 1));
    backlog.record(event("b", 2));
    backlog.record(event("a", 3));
    const page = backlog.after("a", start);
    expect(page.events.map((entry) => (entry.data as { n: number }).n)).toEqual([1, 3]);
    expect(page.reset).toBe(false);
    expect(backlog.after("a", page.cursor).events).toEqual([]);
  });

  it("says reset when the cursor predates what it kept", () => {
    let now = 0;
    const backlog = new EventBacklog(() => now);
    const start = backlog.cursor;
    backlog.record(event("a", 1));
    now = 6 * 60_000;
    backlog.record(event("a", 2));
    const page = backlog.after("a", start);
    expect(page.reset).toBe(true);
    expect(page.events.map((entry) => (entry.data as { n: number }).n)).toEqual([2]);
  });

  it("keeps at most 500 events per app", () => {
    const backlog = new EventBacklog();
    for (let n = 0; n < 600; n += 1) backlog.record(event("a", n));
    const page = backlog.after("a", 0);
    expect(page.events).toHaveLength(500);
    expect(page.reset).toBe(true);
  });

  it("wakes a waiter on that app's next event only", async () => {
    const backlog = new EventBacklog();
    let woke = false;
    const waiting = backlog.wait("a", 5_000).then(() => (woke = true));
    backlog.record(event("b", 1));
    await Promise.resolve();
    expect(woke).toBe(false);
    backlog.record(event("a", 2));
    await waiting;
    expect(woke).toBe(true);
  });
});

describe("GET /api/apps/:id/poll", () => {
  let ctx: TestContext;
  let owner: { token: string };
  let appId: string;

  beforeEach(async () => {
    ctx = await createTestContext();
    owner = await ctx.user("owner@acme.test");
    appId = (await seedApp(ctx, owner.token)).app.id;
  });
  afterEach(async () => {
    await ctx.close();
  });

  const poll = (query: string) =>
    ctx.request(`/api/apps/${appId}/poll${query}`, { token: owner.token });

  it("hands out a cursor, then the events published after it", async () => {
    const first = await (await poll("")).json();
    expect(first.events).toEqual([]);
    ctx.deps.hub.publish({ type: "channel", appId, data: { id: "c1" } });
    const next = await (await poll(`?after=${first.cursor}&wait=0`)).json();
    expect(next.events).toEqual([{ type: "channel", data: { id: "c1" } }]);
    expect(Number(next.cursor)).toBeGreaterThan(Number(first.cursor));
  });

  it("holds the request until an event arrives", async () => {
    const { cursor } = await (await poll("")).json();
    const started = Date.now();
    const pending = poll(`?after=${cursor}&wait=5`);
    setTimeout(() => ctx.deps.hub.publish({ type: "device", appId, data: { n: 1 } }), 150);
    const body = await (await pending).json();
    expect(body.events).toHaveLength(1);
    expect(Date.now() - started).toBeLessThan(4_000);
  });

  it("asks for a reset on a malformed cursor and refuses a stranger", async () => {
    expect((await (await poll("?after=abc")).json()).reset).toBe(true);
    const stranger = await ctx.user("stranger@elsewhere.test");
    const response = await ctx.request(`/api/apps/${appId}/poll`, { token: stranger.token });
    expect([403, 404]).toContain(response.status);
  });
});
