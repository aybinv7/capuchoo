import { Hono } from "hono";
import { principal, type AppEnv } from "../http/context";
import { forbidden } from "../lib/errors";
import { writeAudit } from "../repositories/audit";
import { DEMO_SLUG, seedDemo } from "../demo";

/**
 * The demo organization, for presentations. Only an instance admin may (re)create it, and only on
 * a server whose operator turned it on, since it writes four weeks of fictional data.
 */
export function demoRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get("/admin/demo", async (c) => {
    const deps = c.get("deps");
    const who = principal(c);
    if (!who.isInstanceAdmin)
      throw forbidden("Only an instance admin can see the demo organization");
    const organization = await deps.db
      .selectFrom("organizations")
      .select(["id", "name", "created_at", "updated_at"])
      .where("slug", "=", DEMO_SLUG)
      .executeTakeFirst();
    return c.json({
      enabled: deps.config.DEMO_SEED === "enabled",
      organization: organization ?? null,
    });
  });

  router.post("/admin/demo", async (c) => {
    const deps = c.get("deps");
    const who = principal(c);
    if (!who.isInstanceAdmin)
      throw forbidden("Only an instance admin can create the demo organization");
    if (deps.config.DEMO_SEED !== "enabled") {
      throw forbidden(
        "The demo organization is disabled on this server (DEMO_SEED)",
        "demo_disabled",
      );
    }
    const summary = await seedDemo(deps.db, { ownerId: who.userId, now: deps.now() });
    await writeAudit(deps.db, {
      organizationId: summary.organization_id,
      actorUserId: who.userId,
      actorApiKeyId: who.credential.type === "api_key" ? who.credential.keyId : null,
      action: "demo.seed",
      targetType: "organization",
      targetId: summary.organization_id,
      details: { apps: summary.apps.map((app) => app.name) },
      ip: c.get("clientIp"),
    });
    return c.json(summary, 201);
  });

  return router;
}
