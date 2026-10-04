import { Hono } from "hono";
import { requireApp } from "../access/app-access";
import { queryInt } from "../http/body";
import { principal, type AppEnv } from "../http/context";
import { recordingStats } from "../services/recording-summary";

/** What session recording saw in an app over a window: the counterpart of `/apps/:id/stats`. */
export function recordingStatsRoutes() {
  const router = new Hono<AppEnv>();

  router.get("/apps/:id/recording-stats", async (c) => {
    const deps = c.get("deps");
    const access = await requireApp(
      deps.db,
      principal(c),
      c.req.param("id"),
      "viewer",
      "Reading recording statistics",
    );
    return c.json(await recordingStats(deps, access.app.id, queryInt(c, "days", 30, 1, 365)));
  });

  return router;
}
