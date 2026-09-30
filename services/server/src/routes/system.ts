import { Hono } from "hono";
import { sql } from "kysely";
import type { AppEnv } from "../http/context";
import { readJson } from "../http/body";
import { handleGitlabHook } from "../services/gitlab";

/** Health probes and third-party webhooks. */
export function systemRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get("/health", (c) => c.json({ status: "ok" }));

  router.get("/ready", async (c) => {
    const deps = c.get("deps");
    const [database, storage] = await Promise.all([
      sql`SELECT 1`.execute(deps.db).then(
        () => true,
        () => false,
      ),
      deps.storage.healthy(),
    ]);
    const ok = database && storage;
    return c.json(
      { status: ok ? "ok" : "degraded", database, storage, storage_driver: deps.storage.name },
      ok ? 200 : 503,
    );
  });

  router.post("/api/integrations/gitlab/:appId", async (c) => {
    const result = await handleGitlabHook(c.get("deps"), {
      appReference: c.req.param("appId"),
      token: c.req.header("x-gitlab-token"),
      body: await readJson<unknown>(c, 2 * 1024 * 1024),
    });
    return c.json(result);
  });

  return router;
}
