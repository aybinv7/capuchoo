import { Readable } from "node:stream";
import { Hono } from "hono";
import {
  DEFAULT_RECORDING_POLICY,
  RECORDING_LIMITS,
  RECORDING_RULE_SCOPES,
  normaliseRecordingPatch,
  resolveRecordingPolicy,
  type RecordingRuleScope,
} from "@capuchoo/core";
import { requireApp } from "../access/app-access";
import { queryInt, readJson } from "../http/body";
import { principal, type AppContext, type AppEnv } from "../http/context";
import {
  serializeRecordingAsset,
  serializeRecordingRule,
  serializeRecordingSegment,
  serializeRecordingSession,
} from "../http/recording-serializers";
import { badRequest, notFound } from "../lib/errors";
import type { App } from "../db/schema";
import { isUuid } from "../repositories/apps";
import { writeAudit } from "../repositories/audit";
import { findChannel, listChannels } from "../repositories/channels";
import { findDeviceById } from "../repositories/devices";
import { listRecorderHealth } from "../repositories/recorder-health";
import { findAsset, listAssets } from "../repositories/recording-assets";
import {
  deleteRule,
  findRule,
  findRuleById,
  layersFor,
  saveRule,
} from "../repositories/recording-rules";
import {
  deleteSession,
  findSegment,
  findSession,
  listSegments,
  listSessions,
} from "../repositories/recording-sessions";
import { resolveDeviceChannel } from "../services/channel-resolution";
import { cachedRules } from "../services/recording-policy";

const RULE_BODY_BYTES = 16 * 1024;
const HEALTH_LIST_LIMIT = 50;
/** A device writes its health at least every two minutes while it runs. */
const ONLINE_WINDOW_MS = 3 * 60_000;

function parseCursor(raw: string | undefined): { startedAt: Date; id: string } | undefined {
  if (!raw) return undefined;
  const [time, id] = raw.split("_");
  const startedAt = new Date(Number(time));
  if (!id || !isUuid(id) || Number.isNaN(startedAt.getTime())) throw badRequest("Invalid cursor");
  return { startedAt, id };
}

async function audit(
  c: AppContext,
  app: App,
  action: string,
  targetId: string | null,
  details?: Record<string, unknown>,
) {
  const who = principal(c);
  await writeAudit(c.get("deps").db, {
    organizationId: app.organization_id,
    appId: app.id,
    actorUserId: who.userId,
    actorApiKeyId: who.credential.type === "api_key" ? who.credential.keyId : null,
    action,
    targetType: "recording_rule",
    targetId,
    ...(details ? { details } : {}),
    ip: c.get("clientIp"),
  });
}

async function loadSession(
  c: AppContext,
  action: string,
  minimum: "viewer" | "developer" = "viewer",
) {
  const deps = c.get("deps");
  const id = c.req.param("id") ?? "";
  if (!isUuid(id)) throw notFound("Recording");
  const session = await findSession(deps.db, id);
  if (!session) throw notFound("Recording");
  const access = await requireApp(deps.db, principal(c), session.app_id, minimum, action);
  return { session, access };
}

/** Recorded sessions, their segments and assets, and the rules deciding what devices record. */
export function recordingRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get("/apps/:id/recordings", async (c) => {
    const deps = c.get("deps");
    const access = await requireApp(
      deps.db,
      principal(c),
      c.req.param("id"),
      "viewer",
      "Listing recordings",
    );
    const deviceUuid = c.req.query("device_id");
    if (deviceUuid && !isUuid(deviceUuid)) throw badRequest("device_id must be a device uuid");
    const limit = queryInt(c, "limit", 50, 1, 200);
    const rows = await listSessions(deps.db, {
      appId: access.app.id,
      deviceUuid: deviceUuid || undefined,
      version: c.req.query("version")?.slice(0, 64) || undefined,
      withErrors: c.req.query("errors") === "true",
      start: c.req.query("start")?.slice(0, 16) || undefined,
      before: parseCursor(c.req.query("before")),
      limit: limit + 1,
    });
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return c.json({
      sessions: page.map((row) => serializeRecordingSession(row, deps.now())),
      next_cursor: rows.length > limit && last ? `${last.started_at.getTime()}_${last.id}` : null,
    });
  });

  router.get("/recordings/:id", async (c) => {
    const deps = c.get("deps");
    const { session } = await loadSession(c, "Watching a recording");
    const [segments, assets] = await Promise.all([
      listSegments(deps.db, session.id),
      listAssets(deps.db, session.app_id, session.version_name),
    ]);
    return c.json({
      session: serializeRecordingSession(session, deps.now()),
      segments: segments.map(serializeRecordingSegment),
      assets: assets.map(serializeRecordingAsset),
    });
  });

  router.get("/recordings/:id/segments/:seq", async (c) => {
    const deps = c.get("deps");
    const { session } = await loadSession(c, "Watching a recording");
    const seq = Number.parseInt(c.req.param("seq"), 10);
    if (!Number.isInteger(seq) || seq < 0) throw notFound("Segment");
    const segment = await findSegment(deps.db, session.id, seq);
    if (!segment) throw notFound("Segment");
    const object = await deps.storage.get(segment.storage_key);
    return c.body(Readable.toWeb(object.body) as ReadableStream, 200, {
      "content-type": "application/x-ndjson",
      "content-encoding": "gzip",
      "content-length": String(object.size),
      "cache-control": "private, max-age=31536000, immutable",
    });
  });

  router.delete("/recordings/:id", async (c) => {
    const deps = c.get("deps");
    const { session } = await loadSession(c, "Deleting a recording", "developer");
    const keys = await deleteSession(deps.db, session.id);
    deps.tasks.run("recording delete", async () => {
      for (const key of keys) await deps.storage.delete(key);
    });
    return c.body(null, 204);
  });

  router.get("/recording-assets/:id", async (c) => {
    const deps = c.get("deps");
    const id = c.req.param("id");
    if (!isUuid(id)) throw notFound("Asset");
    const asset = await findAsset(deps.db, id);
    if (!asset) throw notFound("Asset");
    await requireApp(deps.db, principal(c), asset.app_id, "viewer", "Watching a recording");
    const object = await deps.storage.get(asset.storage_key);
    return c.body(Readable.toWeb(object.body) as ReadableStream, 200, {
      "content-type": asset.content_type,
      "content-length": String(object.size),
      "cache-control": "private, max-age=31536000, immutable",
    });
  });

  router.get("/apps/:id/recording-rules", async (c) => {
    const deps = c.get("deps");
    const access = await requireApp(
      deps.db,
      principal(c),
      c.req.param("id"),
      "viewer",
      "Reading recording rules",
    );
    const rules = await cachedRules(deps, access.app.id);
    return c.json({
      rules: rules.map(serializeRecordingRule),
      defaults: DEFAULT_RECORDING_POLICY,
      limits: RECORDING_LIMITS,
    });
  });

  router.get("/apps/:id/recorder-health", async (c) => {
    const deps = c.get("deps");
    const access = await requireApp(
      deps.db,
      principal(c),
      c.req.param("id"),
      "viewer",
      "Reading recorder health",
    );
    const rows = await listRecorderHealth(deps.db, access.app.id, HEALTH_LIST_LIMIT);
    const now = deps.now().getTime();
    return c.json({
      devices: rows.map((row) => ({
        device_id: row.device_id,
        device_uuid: row.device_uuid,
        custom_id: row.custom_id,
        model: row.model,
        manufacturer: row.manufacturer,
        platform: row.platform,
        version_name: row.version_name,
        channel: row.channel,
        health: row.health,
        seen_at: row.seen_at.toISOString(),
        online: now - row.seen_at.getTime() < ONLINE_WINDOW_MS,
      })),
    });
  });

  router.put("/apps/:id/recording-rules", async (c) => {
    const deps = c.get("deps");
    const access = await requireApp(
      deps.db,
      principal(c),
      c.req.param("id"),
      "developer",
      "Changing what devices record",
    );
    const body = await readJson(c, RULE_BODY_BYTES);
    const scope = body.scope as RecordingRuleScope;
    if (!RECORDING_RULE_SCOPES.includes(scope))
      throw badRequest("scope must be app, channel or device");

    let channelId: string | null = null;
    let deviceUuid: string | null = null;
    if (scope === "channel") {
      const id = typeof body.channel_id === "string" ? body.channel_id : "";
      const channel = isUuid(id) ? await findChannel(deps.db, id) : undefined;
      if (!channel || channel.app_id !== access.app.id) throw notFound("Channel");
      channelId = channel.id;
    }
    if (scope === "device") {
      const id = typeof body.device_id === "string" ? body.device_id : "";
      const device = isUuid(id) ? await findDeviceById(deps.db, id) : undefined;
      if (!device || device.app_id !== access.app.id) throw notFound("Device");
      deviceUuid = device.id;
    }

    const { patch, dropped } = normaliseRecordingPatch(body.policy ?? {});
    const target = { appId: access.app.id, scope, channelId, deviceUuid };
    const existing = await findRule(deps.db, target);
    const now = deps.now();

    let liveUntil = existing?.live_until ?? null;
    if (body.live_minutes === null) liveUntil = null;
    else if (body.live_minutes !== undefined) {
      const minutes = Number(body.live_minutes);
      const { min, max } = RECORDING_LIMITS.liveMinutes;
      if (!Number.isFinite(minutes) || minutes < min || minutes > max) {
        throw badRequest(`live_minutes must be between ${min} and ${max}`);
      }
      liveUntil = new Date(now.getTime() + Math.round(minutes) * 60_000);
    }

    const rule = await saveRule(deps.db, {
      ...target,
      policy: body.policy === undefined && existing ? existing.policy : patch,
      liveUntil,
      updatedBy: principal(c).userId,
      now,
    });
    deps.cache.invalidate(`app:${access.app.id}`);
    deps.hub.publish({
      type: "recording_rule",
      appId: access.app.id,
      data: { id: rule.id, scope, channel_id: channelId, device_uuid: deviceUuid },
    });
    await audit(
      c,
      access.app,
      existing ? "recording_rule.update" : "recording_rule.create",
      rule.id,
      {
        scope,
        channel_id: channelId,
        device_uuid: deviceUuid,
        live_until: liveUntil?.toISOString() ?? null,
      },
    );
    return c.json({ rule: serializeRecordingRule(rule), dropped });
  });

  router.delete("/recording-rules/:id", async (c) => {
    const deps = c.get("deps");
    const id = c.req.param("id");
    const rule = isUuid(id) ? await findRuleById(deps.db, id) : undefined;
    if (!rule) throw notFound("Recording rule");
    const access = await requireApp(
      deps.db,
      principal(c),
      rule.app_id,
      "developer",
      "Changing what devices record",
    );
    await deleteRule(deps.db, rule.id);
    deps.cache.invalidate(`app:${access.app.id}`);
    deps.hub.publish({
      type: "recording_rule",
      appId: access.app.id,
      data: { id: rule.id, scope: rule.scope, removed: true },
    });
    await audit(c, access.app, "recording_rule.delete", rule.id, { scope: rule.scope });
    return c.body(null, 204);
  });

  router.get("/devices/:id/recording-policy", async (c) => {
    const deps = c.get("deps");
    const id = c.req.param("id");
    const device = isUuid(id) ? await findDeviceById(deps.db, id) : undefined;
    if (!device) throw notFound("Device");
    const access = await requireApp(
      deps.db,
      principal(c),
      device.app_id,
      "viewer",
      "Reading a device's recording policy",
    );
    const [channels, rules] = await Promise.all([
      listChannels(deps.db, access.app.id),
      cachedRules(deps, access.app.id),
    ]);
    const { channel } = resolveDeviceChannel({
      channels,
      device,
      reported: device.reported_channel ?? undefined,
    });
    const policy = resolveRecordingPolicy(layersFor(rules, channel?.id ?? null, device.id), {
      deviceId: device.device_id,
      now: deps.now().getTime(),
    });
    return c.json({ policy, channel_id: channel?.id ?? null });
  });

  return router;
}
