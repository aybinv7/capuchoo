import { Hono } from "hono";
import { requireApp } from "../access/app-access";
import { queryInt } from "../http/body";
import { principal, type AppEnv } from "../http/context";

const MAX_WAIT_S = 25;

/**
 * The app's live events as a long poll, for clients behind a proxy that buffers a stream until
 * it ends. Answers at once when events are waiting, else holds up to `wait` seconds.
 */
export function livePollRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get("/apps/:id/poll", async (c) => {
    const deps = c.get("deps");
    const access = await requireApp(
      deps.db,
      principal(c),
      c.req.param("id"),
      "viewer",
      "Watching the app",
    );
    c.header("cache-control", "no-store");
    const raw = c.req.query("after");
    const backlog = deps.hub.backlog;
    if (raw === undefined || !/^\d{1,15}$/.test(raw))
      return c.json({ cursor: String(backlog.cursor), events: [], reset: raw !== undefined });

    const after = Number(raw);
    let page = backlog.after(access.app.id, after);
    if (page.events.length === 0 && !page.reset) {
      const wait = queryInt(c, "wait", MAX_WAIT_S, 0, MAX_WAIT_S);
      if (wait > 0) {
        await backlog.wait(access.app.id, wait * 1000, c.req.raw.signal);
        page = backlog.after(access.app.id, after);
      }
    }
    return c.json({
      cursor: String(page.cursor),
      reset: page.reset,
      events: page.events.map((event) => ({ type: event.type, data: event.data })),
    });
  });

  return router;
}
