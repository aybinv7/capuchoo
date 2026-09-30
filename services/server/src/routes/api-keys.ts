import { canIssueCap, isAppRole } from "@capuchoo/core";
import { Hono } from "hono";
import { requireApp } from "../access/app-access";
import { keyAppRestriction, keyRoleCap } from "../auth/principal";
import { API_KEY_PREFIX } from "../auth/tokens";
import { readJson, requireString } from "../http/body";
import { principal, type AppEnv } from "../http/context";
import { randomToken, sha256Hex } from "../lib/crypto";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { createApiKey, listApiKeys, revokeApiKey } from "../repositories/api-keys";
import { writeAudit } from "../repositories/audit";

/** API keys belong to the account that minted them and can never exceed its credential. */
export function apiKeyRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get("/", async (c) => {
    const who = principal(c);
    const keys = await listApiKeys(c.get("deps").db, who.userId);
    return c.json({ success: true, keys });
  });

  router.post("/", async (c) => {
    const who = principal(c);
    const deps = c.get("deps");
    const body = await readJson(c, 8 * 1024);
    const name = requireString(body.name, "name", 120);

    const role = body.role === undefined || body.role === null ? null : body.role;
    if (role !== null && !isAppRole(role))
      throw badRequest("role must be admin, developer, tester or viewer");
    const callerCap = keyRoleCap(who);
    if (!canIssueCap(callerCap, role)) {
      throw forbidden(`This credential is capped at ${callerCap}; it cannot mint a stronger key.`);
    }

    const callerApp = keyAppRestriction(who);
    let appId: string | null = null;
    if (body.app_id !== undefined && body.app_id !== null) {
      const access = await requireApp(
        deps.db,
        who,
        requireString(body.app_id, "app_id"),
        "viewer",
        "Minting a key",
      );
      appId = access.app.id;
    }
    if (callerApp && appId !== callerApp)
      throw forbidden("A key limited to one app can only mint keys for that app.");

    const days = body.expires_in_days === undefined ? null : Number(body.expires_in_days);
    if (days !== null && (!Number.isInteger(days) || days < 1 || days > 3650)) {
      throw badRequest("expires_in_days must be between 1 and 3650");
    }

    const key = randomToken(API_KEY_PREFIX);
    const row = await createApiKey(deps.db, {
      userId: who.userId,
      name,
      keyHash: sha256Hex(key),
      keyPrefix: key.slice(0, 12),
      appId,
      role,
      expiresAt: days ? new Date(deps.now().getTime() + days * 86_400_000) : null,
    });
    await writeAudit(deps.db, {
      appId,
      actorUserId: who.userId,
      actorApiKeyId: who.credential.type === "api_key" ? who.credential.keyId : null,
      action: "api_key.create",
      targetType: "api_key",
      targetId: row.id,
      details: { name, role, app_id: appId },
      ip: c.get("clientIp"),
    });
    return c.json({ success: true, key, ...row }, 201);
  });

  router.delete("/:id", async (c) => {
    const who = principal(c);
    const deps = c.get("deps");
    const revoked = await revokeApiKey(deps.db, who.userId, c.req.param("id"), deps.now());
    if (!revoked) throw notFound("API key");
    await writeAudit(deps.db, {
      actorUserId: who.userId,
      actorApiKeyId: who.credential.type === "api_key" ? who.credential.keyId : null,
      action: "api_key.revoke",
      targetType: "api_key",
      targetId: c.req.param("id"),
      ip: c.get("clientIp"),
    });
    return c.body(null, 204);
  });

  return router;
}
