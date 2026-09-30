import { isFlavour } from "@capuchoo/core";
import { Hono } from "hono";
import { requireApp, type AppAccess } from "../access/app-access";
import type { Channel, ChannelUpdate } from "../db/schema";
import { queryInt, readJson, requireString } from "../http/body";
import { principal, type AppContext, type AppEnv } from "../http/context";
import { serializeBundle, serializeChannel, serializeNative } from "../http/serializers";
import { badRequest, conflict, isUniqueViolation, notFound } from "../lib/errors";
import {
  findBundle,
  findBundleByVersion,
  findNativeBuild,
  findNativeByCode,
} from "../repositories/artefacts";
import { isUuid } from "../repositories/apps";
import { writeAudit } from "../repositories/audit";
import {
  channelHistory,
  clientsOf,
  createChannel,
  deleteChannel,
  findChannel,
  findChannelByName,
  hasEverPointed,
  servedArtefactIds,
  updateChannel,
} from "../repositories/channels";
import { channelHealth } from "../repositories/device-events";
import { pointChannel, setChannelPaused, type Artefact } from "../services/delivery";
import { publishChannel } from "../services/live-events";

const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const FLAGS = [
  "allow_dev",
  "allow_emulator",
  "ios_enabled",
  "android_enabled",
  "allow_device_self_set",
] as const;

async function channelAccess(
  c: AppContext,
  channelId: string,
  minimum: "viewer" | "developer" | "admin",
  action: string,
) {
  const deps = c.get("deps");
  const channel = await findChannel(deps.db, channelId);
  if (!channel) throw notFound("Channel");
  const access = await requireApp(deps.db, principal(c), channel.app_id, minimum, action);
  return { channel, access };
}

function audit(
  c: AppContext,
  access: AppAccess,
  action: string,
  channel: Channel,
  details?: Record<string, unknown>,
) {
  const who = principal(c);
  return writeAudit(c.get("deps").db, {
    organizationId: access.app.organization_id,
    appId: access.app.id,
    actorUserId: who.userId,
    actorApiKeyId: who.credential.type === "api_key" ? who.credential.keyId : null,
    action,
    targetType: "channel",
    targetId: channel.id,
    details: { channel: channel.name, ...details },
    ip: c.get("clientIp"),
  });
}

/** Every artefact the request names: a bundle, a native build, or one of each. */
async function resolveArtefacts(
  c: AppContext,
  access: AppAccess,
  channel: Channel,
  body: Record<string, unknown>,
): Promise<Artefact[]> {
  const { db } = c.get("deps");
  const platform = typeof body.platform === "string" ? body.platform : "android";
  const artefacts: Artefact[] = [];

  if (typeof body.bundle_id === "string") {
    const row = await findBundle(db, body.bundle_id);
    if (!row || row.app_id !== access.app.id) throw notFound("Bundle");
    artefacts.push({ kind: "ota", row });
  } else if (typeof body.version === "string") {
    const row = await findBundleByVersion(db, access.app.id, platform, body.version);
    if (!row) throw notFound(`Bundle ${body.version}`);
    artefacts.push({ kind: "ota", row });
  }

  if (typeof body.native_id === "string") {
    const row = await findNativeBuild(db, body.native_id);
    if (!row || row.app_id !== access.app.id) throw notFound("Native build");
    artefacts.push({ kind: "native", row });
  } else if (body.version_code !== undefined) {
    const code = Number(body.version_code);
    if (!Number.isInteger(code)) throw badRequest("version_code must be an integer");
    const row = await findNativeByCode(db, access.app.id, platform, channel.environment, code);
    if (!row) throw notFound(`Native build ${code}`);
    artefacts.push({ kind: "native", row });
  }

  if (artefacts.length === 0) {
    throw badRequest("Name what to deliver: bundle_id or version, native_id or version_code");
  }
  return artefacts;
}

/** Channel creation, settings and the delivery actions: point, rollback, pause, resume, history. */
export function channelRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  const create = async (c: AppContext) => {
    const deps = c.get("deps");
    const body = await readJson(c, 8 * 1024);
    const access = await requireApp(
      deps.db,
      principal(c),
      requireString(body.app_id, "app_id"),
      "admin",
      "Creating a channel",
    );
    const name = requireString(body.name, "name", 64);
    if (!NAME.test(name))
      throw badRequest(
        "A channel name uses letters, digits, . _ - and starts with a letter or digit",
      );

    const kind = body.kind === "client" || body.client === true ? "client" : "release";
    let environment = body.environment;
    let baseChannelId: string | null = null;
    if (kind === "client") {
      const baseRef = requireString(body.base ?? body.base_channel_id ?? "prod", "base");
      const base = isUuid(baseRef)
        ? await findChannel(deps.db, baseRef)
        : await findChannelByName(deps.db, access.app.id, baseRef);
      if (!base || base.app_id !== access.app.id) throw notFound(`Base channel "${baseRef}"`);
      if (base.kind !== "release")
        throw badRequest("A client channel follows a release channel, not another client channel");
      baseChannelId = base.id;
      if (environment !== undefined && environment !== base.environment) {
        throw badRequest(`A client channel serves its base's environment (${base.environment})`);
      }
      environment = base.environment;
    }
    if (!isFlavour(environment)) throw badRequest("environment is required: dev, staging or prod");

    try {
      const channel = await createChannel(deps.db, {
        appId: access.app.id,
        name,
        environment,
        kind,
        baseChannelId,
        isPublic: body.public === true,
        allowDeviceSelfSet: body.allow_device_self_set === true,
      });
      deps.cache.invalidate(`app:${access.app.id}`);
      await audit(c, access, "channel.create", channel, { environment, kind, base: baseChannelId });
      publishChannel(deps, channel);
      return c.json(serializeChannel(channel), 201);
    } catch (error) {
      if (isUniqueViolation(error))
        throw conflict(`Channel "${name}" already exists`, "channel_exists");
      throw error;
    }
  };

  const update = async (c: AppContext) => {
    const deps = c.get("deps");
    const { channel, access } = await channelAccess(
      c,
      c.req.param("id") ?? "",
      "admin",
      "Editing a channel",
    );
    const body = await readJson(c, 8 * 1024);
    const patch: ChannelUpdate = {};
    for (const flag of FLAGS) {
      if (body[flag] !== undefined) {
        if (typeof body[flag] !== "boolean") throw badRequest(`${flag} must be a boolean`);
        patch[flag] = body[flag];
      }
    }
    if (body.public !== undefined) patch.is_public = body.public === true;
    if (body.name !== undefined) {
      const name = requireString(body.name, "name", 64);
      if (!NAME.test(name)) throw badRequest("Invalid channel name");
      patch.name = name;
    }
    if (body.environment !== undefined && body.environment !== channel.environment) {
      if (!isFlavour(body.environment))
        throw badRequest("environment must be dev, staging or prod");
      if (channel.kind === "client")
        throw conflict("A client channel's environment follows its base", "environment_locked");
      if (
        (await hasEverPointed(deps.db, channel.id)) ||
        (await clientsOf(deps.db, channel.id)).length > 0
      ) {
        throw conflict(
          "This channel has already served releases; its environment is fixed. Create a new channel instead.",
          "environment_locked",
        );
      }
      patch.environment = body.environment;
    }
    for (const forbidden of [
      "current_version_id",
      "current_native_version_id",
      "current_bundle_id",
      "current_native_id",
      "app_id",
      "paused",
      "allow_downgrade",
    ]) {
      if (body[forbidden] !== undefined)
        throw badRequest(
          `${forbidden} cannot be edited here; use the delivery actions`,
          "use_delivery_actions",
        );
    }
    try {
      const updated = await updateChannel(deps.db, channel.id, patch);
      deps.cache.invalidate(`app:${access.app.id}`);
      await audit(c, access, "channel.update", updated, patch as Record<string, unknown>);
      publishChannel(deps, updated);
      return c.json(serializeChannel(updated));
    } catch (error) {
      if (isUniqueViolation(error))
        throw conflict("A channel by that name already exists", "channel_exists");
      throw error;
    }
  };

  const remove = async (c: AppContext) => {
    const deps = c.get("deps");
    const { channel, access } = await channelAccess(
      c,
      c.req.param("id") ?? "",
      "admin",
      "Deleting a channel",
    );
    const expectedApp = c.req.query("app_id");
    if (expectedApp && expectedApp !== access.app.id && expectedApp !== access.app.app_id)
      throw notFound("Channel");
    const clients = await clientsOf(deps.db, channel.id);
    if (clients.length > 0) {
      throw conflict(
        `Client channels follow this one: ${clients.map((client) => client.name).join(", ")}. Delete them first.`,
        "has_clients",
      );
    }
    await deleteChannel(deps.db, channel.id);
    deps.cache.invalidate(`app:${access.app.id}`);
    await audit(c, access, "channel.delete", channel);
    return c.body(null, 204);
  };

  router.post("/dashboard/channels", create);
  router.put("/dashboard/channels/:id", update);
  router.delete("/dashboard/channels/:id", remove);
  router.post("/channels", create);
  router.put("/channels/:id", update);
  router.delete("/channels/:id", remove);

  router.get("/channels/:id", async (c) => {
    const deps = c.get("deps");
    const { channel, access } = await channelAccess(
      c,
      c.req.param("id"),
      "viewer",
      "Reading a channel",
    );
    const [bundle, native, health] = await Promise.all([
      channel.current_bundle_id ? findBundle(deps.db, channel.current_bundle_id) : undefined,
      channel.current_native_id ? findNativeBuild(deps.db, channel.current_native_id) : undefined,
      channelHealth(deps.db, access.app.id, deps.now()),
    ]);
    return c.json({
      ...serializeChannel(channel),
      current_bundle: bundle ? serializeBundle(bundle) : null,
      current_native: native ? serializeNative(native) : null,
      health: health.find((row) => row.channel_id === channel.id) ?? null,
    });
  });

  router.post("/channels/:id/point", async (c) => {
    const deps = c.get("deps");
    const { channel, access } = await channelAccess(
      c,
      c.req.param("id"),
      "developer",
      "Delivering",
    );
    const body = await readJson(c, 8 * 1024);
    const artefacts = await resolveArtefacts(c, access, channel, body);
    const updated = await pointChannel(deps, {
      access,
      principal: principal(c),
      channel,
      artefacts,
      rollback: body.rollback === true,
      reason: typeof body.reason === "string" ? body.reason.slice(0, 500) : null,
      ip: c.get("clientIp"),
    });
    return c.json(serializeChannel(updated));
  });

  for (const [path, paused] of [
    ["pause", true],
    ["resume", false],
  ] as const) {
    router.post(`/channels/:id/${path}`, async (c) => {
      const { channel, access } = await channelAccess(
        c,
        c.req.param("id"),
        "developer",
        paused ? "Pausing" : "Resuming",
      );
      const body = await readJson(c, 8 * 1024);
      const updated = await setChannelPaused(c.get("deps"), {
        access,
        principal: principal(c),
        channel,
        paused,
        reason: typeof body.reason === "string" ? body.reason.slice(0, 500) : null,
        ip: c.get("clientIp"),
      });
      return c.json(serializeChannel(updated));
    });
  }

  router.get("/channels/:id/served", async (c) => {
    const { channel } = await channelAccess(c, c.req.param("id"), "viewer", "Reading history");
    return c.json({
      channel_id: channel.id,
      artefact_ids: await servedArtefactIds(c.get("deps").db, channel.id),
    });
  });

  router.get("/channels/:id/history", async (c) => {
    const { channel } = await channelAccess(c, c.req.param("id"), "viewer", "Reading history");
    const rows = await channelHistory(
      c.get("deps").db,
      channel.id,
      queryInt(c, "limit", 50, 1, 500),
    );
    return c.json(
      rows.map((row) => ({
        ...row,
        created_at: new Date(row.created_at).toISOString(),
        bundle_id: row.action.endsWith("_bundle") ? row.to_id : null,
        native_id: row.action.endsWith("_native") ? row.to_id : null,
        version_name: row.to_version,
      })),
    );
  });

  return router;
}
