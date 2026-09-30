import {
  decideAppRegistration,
  describeAppConflict,
  isAppRole,
  isFlavour,
  isValidBundleId,
  pemBody,
  publicKeyFingerprint,
} from "@capuchoo/core";
import { Hono } from "hono";
import { requireApp, requireOrgRole } from "../access/app-access";
import { keyAppRestriction } from "../auth/principal";
import { WEBHOOK_PREFIX } from "../auth/tokens";
import { baseUrl, readJson, requireString } from "../http/body";
import { principal, type AppContext, type AppEnv } from "../http/context";
import {
  serializeApp,
  serializeBundle,
  serializeChannel,
  serializeNative,
} from "../http/serializers";
import { randomToken, sha256Hex } from "../lib/crypto";
import { badRequest, conflict, isUniqueViolation, notFound } from "../lib/errors";
import { deleteAppConfig, listAppConfig, upsertAppConfig } from "../repositories/app-config";
import {
  addIdentifier,
  appCounts,
  appRoleFor,
  createApp,
  deleteApp,
  findApp,
  identifierOwner,
  listAccessibleApps,
  listIdentifiers,
  listPermissions,
  removeIdentifier,
  removePermission,
  updateApp,
  upsertPermission,
} from "../repositories/apps";
import { listBundles, listNativeBuilds } from "../repositories/artefacts";
import { writeAudit } from "../repositories/audit";
import { listChannels } from "../repositories/channels";
import {
  deleteIntegration,
  findIntegration,
  upsertIntegration,
} from "../repositories/integrations";
import { findUserByEmail } from "../repositories/users";

function audit(
  c: AppContext,
  app: { id: string; organization_id: string },
  action: string,
  targetType: string,
  targetId: string | null,
  details?: Record<string, unknown>,
) {
  const who = principal(c);
  return writeAudit(c.get("deps").db, {
    organizationId: app.organization_id,
    appId: app.id,
    actorUserId: who.userId,
    actorApiKeyId: who.credential.type === "api_key" ? who.credential.keyId : null,
    action,
    targetType,
    targetId,
    ...(details ? { details } : {}),
    ip: c.get("clientIp"),
  });
}

/** Apps and everything configured on one: permissions, identifiers, signing, integrations, remote config. */
export function appRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get("/", async (c) => {
    const who = principal(c);
    const apps = await listAccessibleApps(c.get("deps").db, who.userId, who.isInstanceAdmin);
    const restricted = keyAppRestriction(who);
    return c.json(
      apps
        .filter((app) => !restricted || app.id === restricted)
        .map((app) => serializeApp(app, app.role)),
    );
  });

  router.post("/", async (c) => {
    const who = principal(c);
    const deps = c.get("deps");
    const body = await readJson(c, 8 * 1024);
    const organizationId = requireString(body.organization_id, "organization_id");
    const bundleId = requireString(body.app_id, "app_id");
    if (!isValidBundleId(bundleId))
      throw badRequest(`"${bundleId}" is not a valid bundle identifier`);
    await requireOrgRole(deps.db, who, organizationId, "admin");

    const existing = await findApp(deps.db, bundleId);
    const registration = decideAppRegistration({
      appId: bundleId,
      requestedOrganizationId: organizationId,
      existing: existing
        ? { id: existing.id, app_id: existing.app_id, organization_id: existing.organization_id }
        : null,
      existingOrganizationExists: true,
      callerHasDirectPermission: existing
        ? (await appRoleFor(deps.db, existing.id, who.userId)) === "admin"
        : false,
    });
    if (registration.kind === "conflict")
      throw conflict(describeAppConflict(bundleId), "app_taken");
    if (registration.kind === "adopt" && existing)
      return c.json({ ...serializeApp(existing, "admin"), adopted: true });

    const owner = await identifierOwner(deps.db, bundleId);
    if (owner)
      throw conflict(
        `${bundleId} is already registered as an identifier of another app.`,
        "identifier_taken",
      );
    try {
      const app = await createApp(deps.db, {
        organizationId,
        bundleId,
        name: requireString(body.name, "name", 120),
        platform: typeof body.platform === "string" ? body.platform : "all",
      });
      await audit(c, app, "app.create", "app", app.id, { app_id: bundleId });
      return c.json(serializeApp(app, "admin"), 201);
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict(describeAppConflict(bundleId), "app_taken");
      throw error;
    }
  });

  router.get("/:id", async (c) => {
    const access = await requireApp(
      c.get("deps").db,
      principal(c),
      c.req.param("id"),
      "viewer",
      "Reading the app",
    );
    const counts = await appCounts(c.get("deps").db, access.app.id);
    return c.json({ ...serializeApp(access.app, access.role), counts, org_role: access.orgRole });
  });

  router.put("/:id", async (c) => {
    const access = await requireApp(
      c.get("deps").db,
      principal(c),
      c.req.param("id"),
      "admin",
      "Editing the app",
    );
    const body = await readJson(c, 8 * 1024);
    const patch: Parameters<typeof updateApp>[2] = {};
    if (body.name !== undefined) patch.name = requireString(body.name, "name", 120);
    if (body.icon_url !== undefined)
      patch.icon_url = typeof body.icon_url === "string" ? body.icon_url.slice(0, 2000) : null;
    if (body.prod_role !== undefined) {
      if (body.prod_role !== "admin" && body.prod_role !== "developer")
        throw badRequest("prod_role must be admin or developer");
      patch.prod_role = body.prod_role;
    }
    const app = await updateApp(c.get("deps").db, access.app.id, patch);
    await audit(c, app, "app.update", "app", app.id, patch);
    c.get("deps").cache.invalidate("identity");
    return c.json(serializeApp(app, access.role));
  });

  router.delete("/:id", async (c) => {
    const deps = c.get("deps");
    const who = principal(c);
    const access = await requireApp(deps.db, who, c.req.param("id"), "admin", "Deleting the app");
    await requireOrgRole(deps.db, who, access.app.organization_id, "admin");
    await audit(c, access.app, "app.delete", "app", access.app.id, { app_id: access.app.app_id });
    await deleteApp(deps.db, access.app.id);
    deps.cache.invalidate("identity");
    deps.cache.invalidate(`app:${access.app.id}`);
    return c.body(null, 204);
  });

  router.get("/:id/permissions", async (c) => {
    const access = await requireApp(
      c.get("deps").db,
      principal(c),
      c.req.param("id"),
      "admin",
      "Listing permissions",
    );
    const rows = await listPermissions(c.get("deps").db, access.app.id);
    return c.json(
      rows.map((row) => ({
        user_id: row.user_id,
        role: row.role,
        created_at: row.created_at,
        users: { id: row.user_id, email: row.email, full_name: row.full_name },
      })),
    );
  });

  router.post("/:id/permissions", async (c) => {
    const deps = c.get("deps");
    const access = await requireApp(
      deps.db,
      principal(c),
      c.req.param("id"),
      "admin",
      "Granting a role",
    );
    const body = await readJson(c, 8 * 1024);
    if (!isAppRole(body.role)) throw badRequest("role must be admin, developer, tester or viewer");
    const email = requireString(body.email, "email").toLowerCase();
    const user = await findUserByEmail(deps.db, email);
    if (!user) throw notFound(`No account for ${email}. Invite them to the organization first`);
    await upsertPermission(deps.db, access.app.id, user.id, body.role);
    await audit(c, access.app, "permission.grant", "user", user.id, { email, role: body.role });
    return c.json(
      {
        user_id: user.id,
        role: body.role,
        users: { id: user.id, email: user.email, full_name: user.full_name },
      },
      201,
    );
  });

  router.delete("/:id/permissions/:userId", async (c) => {
    const deps = c.get("deps");
    const access = await requireApp(
      deps.db,
      principal(c),
      c.req.param("id"),
      "admin",
      "Revoking a role",
    );
    if (!(await removePermission(deps.db, access.app.id, c.req.param("userId"))))
      throw notFound("Permission");
    await audit(c, access.app, "permission.revoke", "user", c.req.param("userId"));
    return c.body(null, 204);
  });

  router.get("/:id/identifiers", async (c) => {
    const access = await requireApp(
      c.get("deps").db,
      principal(c),
      c.req.param("id"),
      "viewer",
      "Listing identifiers",
    );
    return c.json(await listIdentifiers(c.get("deps").db, access.app.id));
  });

  router.post("/:id/identifiers", async (c) => {
    const deps = c.get("deps");
    const access = await requireApp(
      deps.db,
      principal(c),
      c.req.param("id"),
      "admin",
      "Registering an identifier",
    );
    const body = await readJson(c, 8 * 1024);
    const bundleId = requireString(body.bundle_id, "bundle_id");
    if (!isValidBundleId(bundleId))
      throw badRequest(`"${bundleId}" is not a valid bundle identifier`);
    const flavour = body.flavour === undefined || body.flavour === null ? null : body.flavour;
    if (flavour !== null && !isFlavour(flavour))
      throw badRequest("flavour must be prod, staging, dev, or omitted");
    const platform = body.platform === "android" || body.platform === "ios" ? body.platform : "all";
    try {
      const row = await addIdentifier(deps.db, {
        appId: access.app.id,
        bundleId,
        platform,
        flavour,
      });
      deps.cache.invalidate("identity");
      await audit(c, access.app, "identifier.add", "identifier", row.id, {
        bundle_id: bundleId,
        flavour,
      });
      return c.json(row, 201);
    } catch (error) {
      if (isUniqueViolation(error))
        throw conflict(`${bundleId} is already registered.`, "identifier_taken");
      throw error;
    }
  });

  router.delete("/:id/identifiers/:bundleId", async (c) => {
    const deps = c.get("deps");
    const access = await requireApp(
      deps.db,
      principal(c),
      c.req.param("id"),
      "admin",
      "Removing an identifier",
    );
    const bundleId = c.req.param("bundleId");
    if (bundleId === access.app.app_id)
      throw conflict("The app's primary identifier cannot be removed.", "primary_identifier");
    if (!(await removeIdentifier(deps.db, access.app.id, bundleId))) throw notFound("Identifier");
    deps.cache.invalidate("identity");
    await audit(c, access.app, "identifier.remove", "identifier", null, { bundle_id: bundleId });
    return c.body(null, 204);
  });

  router.get("/:id/channels", async (c) => {
    const access = await requireApp(
      c.get("deps").db,
      principal(c),
      c.req.param("id"),
      "viewer",
      "Listing channels",
    );
    return c.json((await listChannels(c.get("deps").db, access.app.id)).map(serializeChannel));
  });

  router.get("/:id/artefacts", async (c) => {
    const deps = c.get("deps");
    const access = await requireApp(
      deps.db,
      principal(c),
      c.req.param("id"),
      "viewer",
      "Listing releases",
    );
    const [bundles, natives, channels] = await Promise.all([
      listBundles(deps.db, access.app.id),
      listNativeBuilds(deps.db, access.app.id),
      listChannels(deps.db, access.app.id),
    ]);
    const servedBy = (id: string) =>
      channels
        .filter((channel) => channel.current_bundle_id === id || channel.current_native_id === id)
        .map((channel) => channel.name);
    const nativeRows = natives.map((row) => ({
      ...serializeNative(row),
      sha256: row.checksum,
      channels: servedBy(row.id),
    }));
    return c.json({
      bundles: bundles.map((row) => ({
        ...serializeBundle(row),
        sha256: row.checksum,
        channels: servedBy(row.id),
      })),
      natives: nativeRows,
      native_builds: nativeRows,
      channels: channels.map(serializeChannel),
    });
  });

  router.get("/:id/releases", async (c) => {
    const deps = c.get("deps");
    const access = await requireApp(
      deps.db,
      principal(c),
      c.req.param("id"),
      "viewer",
      "Listing releases",
    );
    const bundles = await listBundles(deps.db, access.app.id);
    return c.json(bundles.map(serializeBundle));
  });

  router.get("/:id/signing", async (c) => {
    const access = await requireApp(
      c.get("deps").db,
      principal(c),
      c.req.param("id"),
      "viewer",
      "Reading signing",
    );
    const key = access.app.public_key;
    return c.json({
      public_key: key,
      fingerprint: key ? await publicKeyFingerprint(key) : null,
      require_signature: access.app.require_signature,
    });
  });

  router.put("/:id/signing", async (c) => {
    const deps = c.get("deps");
    const access = await requireApp(
      deps.db,
      principal(c),
      c.req.param("id"),
      "admin",
      "Changing the signing key",
    );
    const body = await readJson(c, 16 * 1024);
    const publicKey =
      body.public_key === null ? null : requireString(body.public_key, "public_key", 4000);
    const requireSignature =
      body.require_signature === undefined ? Boolean(publicKey) : body.require_signature === true;
    if (requireSignature && !publicKey) throw badRequest("A required signature needs a public key");
    let fingerprint: string | null = null;
    if (publicKey) {
      try {
        await globalThis.crypto.subtle.importKey(
          "spki",
          Buffer.from(pemBody(publicKey), "base64"),
          { name: "ECDSA", namedCurve: "P-256" },
          false,
          ["verify"],
        );
        fingerprint = await publicKeyFingerprint(publicKey);
      } catch {
        throw badRequest(
          "public_key must be a base64 SPKI (or PEM) ECDSA P-256 key",
          "bad_public_key",
        );
      }
    }
    const app = await updateApp(deps.db, access.app.id, {
      public_key: publicKey,
      require_signature: requireSignature,
    });
    await audit(c, app, "signing.update", "app", app.id, {
      fingerprint,
      require_signature: requireSignature,
    });
    return c.json({ public_key: publicKey, fingerprint, require_signature: requireSignature });
  });

  router.get("/:id/integrations/gitlab", async (c) => {
    const deps = c.get("deps");
    const access = await requireApp(
      deps.db,
      principal(c),
      c.req.param("id"),
      "admin",
      "Reading integrations",
    );
    const integration = await findIntegration(deps.db, access.app.id, "gitlab");
    return c.json({
      configured: Boolean(integration),
      webhook_url: `${baseUrl(c)}/api/integrations/gitlab/${access.app.id}`,
      last_event_at: integration?.last_event_at ?? null,
    });
  });

  router.put("/:id/integrations/gitlab", async (c) => {
    const deps = c.get("deps");
    const access = await requireApp(
      deps.db,
      principal(c),
      c.req.param("id"),
      "admin",
      "Configuring GitLab",
    );
    const body = await readJson(c, 8 * 1024);
    const token = randomToken(WEBHOOK_PREFIX);
    await upsertIntegration(deps.db, {
      appId: access.app.id,
      kind: "gitlab",
      secretHash: sha256Hex(token),
      config: { project: typeof body.project === "string" ? body.project.slice(0, 255) : null },
    });
    await audit(c, access.app, "integration.gitlab", "integration", null);
    return c.json({ webhook_url: `${baseUrl(c)}/api/integrations/gitlab/${access.app.id}`, token });
  });

  router.delete("/:id/integrations/gitlab", async (c) => {
    const deps = c.get("deps");
    const access = await requireApp(
      deps.db,
      principal(c),
      c.req.param("id"),
      "admin",
      "Removing GitLab",
    );
    if (!(await deleteIntegration(deps.db, access.app.id, "gitlab"))) throw notFound("Integration");
    return c.body(null, 204);
  });

  router.get("/:id/config", async (c) => {
    const access = await requireApp(
      c.get("deps").db,
      principal(c),
      c.req.param("id"),
      "viewer",
      "Reading config",
    );
    return c.json(await listAppConfig(c.get("deps").db, access.app.id));
  });

  router.put("/:id/config", async (c) => {
    const deps = c.get("deps");
    const access = await requireApp(
      deps.db,
      principal(c),
      c.req.param("id"),
      "admin",
      "Editing config",
    );
    const body = await readJson(c, 64 * 1024);
    const environment = body.environment ?? "all";
    if (environment !== "all" && !isFlavour(environment))
      throw badRequest("environment must be all, dev, staging or prod");
    const valueType = body.value_type ?? "string";
    if (!["string", "number", "boolean", "json"].includes(String(valueType)))
      throw badRequest("value_type is invalid");
    const key = requireString(body.key, "key", 128);
    if (!/^[A-Za-z_][A-Za-z0-9_.-]{0,127}$/.test(key))
      throw badRequest("key may contain letters, digits, _ . -");
    const row = await upsertAppConfig(deps.db, {
      appId: access.app.id,
      environment: environment as "all",
      channel: typeof body.channel === "string" && body.channel ? body.channel : null,
      key,
      value: typeof body.value === "string" ? body.value : JSON.stringify(body.value ?? ""),
      valueType: valueType as "string",
    });
    deps.cache.invalidate(`app:${access.app.id}`);
    await audit(c, access.app, "config.set", "config", row.id, { key, environment });
    return c.json(row);
  });

  router.delete("/:id/config/:configId", async (c) => {
    const deps = c.get("deps");
    const access = await requireApp(
      deps.db,
      principal(c),
      c.req.param("id"),
      "admin",
      "Editing config",
    );
    if (!(await deleteAppConfig(deps.db, access.app.id, c.req.param("configId"))))
      throw notFound("Config entry");
    deps.cache.invalidate(`app:${access.app.id}`);
    return c.body(null, 204);
  });

  return router;
}
