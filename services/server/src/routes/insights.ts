import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { requireApp, requireDeliverRole } from "../access/app-access";
import { queryInt, readJson } from "../http/body";
import { principal, type AppEnv } from "../http/context";
import { notFound } from "../lib/errors";
import { appCounts, findAppByBundleId } from "../repositories/apps";
import { listAudit } from "../repositories/audit";
import { listBuilds } from "../repositories/builds";
import { buildDetail } from "../services/build-detail";
import { findChannel, listChannels } from "../repositories/channels";
import {
  channelHealth,
  dailyActivity,
  listDeviceEvents,
  versionDistribution,
} from "../repositories/device-events";
import {
  assignDeviceChannel,
  deleteDevice,
  findDeviceById,
  listDevices,
} from "../repositories/devices";
import { appendBuildEvent, finishBuild, openBuild } from "../services/builds";
import type { HubEvent } from "../services/event-hub";
import { publishDevice } from "../services/live-events";

const HEARTBEAT_MS = 25_000;

/** Devices, telemetry, statistics, builds, audit and the live event stream. */
export function insightRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get("/apps/:id/devices", async (c) => {
    const deps = c.get("deps");
    const access = await requireApp(
      deps.db,
      principal(c),
      c.req.param("id"),
      "viewer",
      "Listing devices",
    );
    const days = c.req.query("active_days");
    const { rows, total } = await listDevices(deps.db, {
      appId: access.app.id,
      channelId: c.req.query("channel_id") || undefined,
      search: c.req.query("search")?.slice(0, 100) || undefined,
      activeSince: days
        ? new Date(
            deps.now().getTime() - Math.min(365, Math.max(1, Number(days) || 1)) * 86_400_000,
          )
        : undefined,
      limit: queryInt(c, "limit", 50, 1, 500),
      offset: queryInt(c, "offset", 0, 0, 1_000_000),
    });
    return c.json({
      devices: rows.map((row) => ({
        ...row,
        mem_used_bytes: row.mem_used_bytes === null ? null : Number(row.mem_used_bytes),
      })),
      total,
    });
  });

  router.put("/devices/:id/channel", async (c) => {
    const deps = c.get("deps");
    const device = await findDeviceById(deps.db, c.req.param("id"));
    if (!device) throw notFound("Device");
    const access = await requireApp(
      deps.db,
      principal(c),
      device.app_id,
      "developer",
      "Assigning a device",
    );
    const body = await readJson(c, 4 * 1024);
    let channelId: string | null = null;
    if (typeof body.channel_id === "string") {
      const channel = await findChannel(deps.db, body.channel_id);
      if (!channel || channel.app_id !== access.app.id) throw notFound("Channel");
      requireDeliverRole(access, channel.environment, "Assigning a device");
      channelId = channel.id;
    }
    const updated = await assignDeviceChannel(deps.db, device.id, channelId);
    publishDevice(deps, access.app.id, {
      device_uuid: updated.id,
      device_id: updated.device_id,
      channel_id: updated.channel_id,
      assigned_channel_id: channelId,
      event: "assigned",
      status: null,
      version: updated.version_name,
      version_code: updated.version_code,
      model: updated.model,
      at: deps.now().toISOString(),
    });
    return c.json(updated);
  });

  router.delete("/devices/:id", async (c) => {
    const deps = c.get("deps");
    const device = await findDeviceById(deps.db, c.req.param("id"));
    if (!device) throw notFound("Device");
    await requireApp(deps.db, principal(c), device.app_id, "admin", "Removing a device");
    await deleteDevice(deps.db, device.id);
    return c.body(null, 204);
  });

  router.get("/apps/:id/events", async (c) => {
    const deps = c.get("deps");
    const access = await requireApp(
      deps.db,
      principal(c),
      c.req.param("id"),
      "viewer",
      "Reading events",
    );
    return c.json(
      await listDeviceEvents(deps.db, {
        appId: access.app.id,
        channelId: c.req.query("channel_id") || undefined,
        deviceUuid: c.req.query("device_id") || undefined,
        before: c.req.query("before") || undefined,
        limit: queryInt(c, "limit", 100, 1, 1000),
      }),
    );
  });

  router.get("/apps/:id/stats", async (c) => {
    const deps = c.get("deps");
    const access = await requireApp(
      deps.db,
      principal(c),
      c.req.param("id"),
      "viewer",
      "Reading statistics",
    );
    const days = queryInt(c, "days", 30, 1, 365);
    const since = new Date(deps.now().getTime() - days * 86_400_000);
    const [daily, versions, health, channels, deviceTotal] = await Promise.all([
      dailyActivity(deps.db, access.app.id, since),
      versionDistribution(deps.db, access.app.id, since),
      channelHealth(deps.db, access.app.id, deps.now()),
      listChannels(deps.db, access.app.id),
      appCounts(deps.db, access.app.id).then((counts) => counts.devices),
    ]);
    const totals = daily.reduce(
      (sum, day) => ({
        checks: sum.checks + day.checks,
        installs: sum.installs + day.installs,
        failures: sum.failures + day.failures,
      }),
      { checks: 0, installs: 0, failures: 0 },
    );
    return c.json({
      days,
      totals: {
        ...totals,
        devices: deviceTotal,
        active_24h: health.reduce((sum, row) => sum + row.active_24h, 0),
        success_rate:
          totals.installs + totals.failures
            ? totals.installs / (totals.installs + totals.failures)
            : null,
      },
      daily,
      versions,
      channels: health.map((row) => ({
        ...row,
        name: channels.find((channel) => channel.id === row.channel_id)?.name ?? null,
      })),
    });
  });

  router.get("/apps/:id/audit", async (c) => {
    const deps = c.get("deps");
    const access = await requireApp(
      deps.db,
      principal(c),
      c.req.param("id"),
      "admin",
      "Reading the audit log",
    );
    return c.json(
      await listAudit(deps.db, {
        appId: access.app.id,
        before: c.req.query("before") || undefined,
        limit: queryInt(c, "limit", 100, 1, 500),
      }),
    );
  });

  router.get("/apps/:id/builds", async (c) => {
    const deps = c.get("deps");
    const access = await requireApp(
      deps.db,
      principal(c),
      c.req.param("id"),
      "viewer",
      "Listing builds",
    );
    return c.json(
      await listBuilds(deps.db, access.app.id, queryInt(c, "limit", 30, 1, 200), {
        topLevel: c.req.query("scope") === "top",
        channelId: c.req.query("channel_id") || undefined,
      }),
    );
  });

  router.post("/apps/:id/builds", async (c) => {
    const build = await openBuild(
      c.get("deps"),
      principal(c),
      c.req.param("id"),
      await readJson(c, 16 * 1024),
    );
    return c.json(build, 201);
  });

  router.get("/builds/:id", async (c) => {
    return c.json(await buildDetail(c.get("deps"), principal(c), c.req.param("id")));
  });

  router.post("/builds/:id/events", async (c) => {
    return c.json(
      await appendBuildEvent(
        c.get("deps"),
        principal(c),
        c.req.param("id"),
        await readJson(c, 16 * 1024),
      ),
      201,
    );
  });

  router.post("/builds/:id/finish", async (c) => {
    return c.json(
      await finishBuild(
        c.get("deps"),
        principal(c),
        c.req.param("id"),
        await readJson(c, 16 * 1024),
      ),
    );
  });

  router.get("/apps/:id/stream", async (c) => {
    const deps = c.get("deps");
    const access = await requireApp(
      deps.db,
      principal(c),
      c.req.param("id"),
      "viewer",
      "Watching the app",
    );
    c.header("x-accel-buffering", "no");
    return streamSSE(c, async (stream) => {
      const queue: HubEvent[] = [];
      let wake: (() => void) | null = null;
      const unsubscribe = deps.hub.subscribe(access.app.id, (event) => {
        if (queue.length < 1000) queue.push(event);
        wake?.();
      });
      stream.onAbort(unsubscribe);
      await stream.writeSSE({ event: "ready", data: JSON.stringify({ app_id: access.app.id }) });
      try {
        while (!stream.aborted) {
          const event = queue.shift();
          if (event) {
            await stream.writeSSE({ event: event.type, data: JSON.stringify(event.data) });
            continue;
          }
          await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, HEARTBEAT_MS);
            wake = () => {
              clearTimeout(timer);
              resolve();
            };
          });
          wake = null;
          if (queue.length === 0 && !stream.aborted)
            await stream.writeSSE({ event: "ping", data: "{}" });
        }
      } finally {
        unsubscribe();
      }
    });
  });

  router.get("/dashboard/update-logs", async (c) => {
    const deps = c.get("deps");
    const reference = c.req.query("app_id");
    if (!reference) return c.json([]);
    const identity = await findAppByBundleId(deps.db, reference);
    const access = await requireApp(
      deps.db,
      principal(c),
      identity?.app.id ?? reference,
      "viewer",
      "Reading update logs",
    );
    const events = await listDeviceEvents(deps.db, {
      appId: access.app.id,
      limit: queryInt(c, "limit", 100, 1, 1000),
    });
    return c.json(
      events.map((event) => ({
        action: event.action,
        new_version: event.version_to,
        device_id: event.device_id,
        created_at: event.created_at,
      })),
    );
  });

  return router;
}
