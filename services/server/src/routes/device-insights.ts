import { Hono } from "hono";
import { requireApp } from "../access/app-access";
import { queryInt } from "../http/body";
import { principal, type AppEnv } from "../http/context";
import { badRequest, notFound } from "../lib/errors";
import { findDeviceById } from "../repositories/devices";
import {
  appActivityPage,
  deviceActivity,
  deviceDetail,
  deviceEventPage,
  parseCategory,
} from "../services/device-detail";
import { EventRangeError, parseActivityQuery, parseEventRange } from "../services/event-range";

function bounded<T>(parse: () => T): T {
  try {
    return parse();
  } catch (error) {
    if (error instanceof EventRangeError) throw badRequest(error.message);
    throw error;
  }
}

function category(raw: string | undefined) {
  const parsed = parseCategory(raw);
  if (parsed === null) throw badRequest(`Unknown event category "${raw}"`);
  return parsed;
}

/** A device's detail and timeline, and the app-wide activity feed. */
export function deviceInsightRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get("/devices/:id", async (c) => {
    const deps = c.get("deps");
    const device = await findDeviceById(deps.db, c.req.param("id"));
    if (!device) throw notFound("Device");
    await requireApp(deps.db, principal(c), device.app_id, "viewer", "Reading a device");
    return c.json(
      await deviceDetail(deps.db, device, deps.now(), deps.config.DEVICE_EVENT_RETENTION_DAYS),
    );
  });

  router.get("/devices/:id/events", async (c) => {
    const deps = c.get("deps");
    const device = await findDeviceById(deps.db, c.req.param("id"));
    if (!device) throw notFound("Device");
    await requireApp(deps.db, principal(c), device.app_id, "viewer", "Reading a device");
    return c.json(
      await deviceEventPage(deps.db, {
        appId: device.app_id,
        deviceUuid: device.id,
        ...bounded(() => parseEventRange(c.req.query("from"), c.req.query("to"))),
        category: category(c.req.query("category")),
        before: c.req.query("before") || undefined,
        limit: queryInt(c, "limit", 100, 1, 500),
      }),
    );
  });

  router.get("/devices/:id/activity", async (c) => {
    const deps = c.get("deps");
    const device = await findDeviceById(deps.db, c.req.param("id"));
    if (!device) throw notFound("Device");
    await requireApp(deps.db, principal(c), device.app_id, "viewer", "Reading a device");
    const query = bounded(() =>
      parseActivityQuery({
        from: c.req.query("from"),
        to: c.req.query("to"),
        bucket: c.req.query("bucket"),
        tz: c.req.query("tz"),
      }),
    );
    return c.json(await deviceActivity(deps.db, device, query));
  });

  router.get("/apps/:id/device-events", async (c) => {
    const deps = c.get("deps");
    const access = await requireApp(
      deps.db,
      principal(c),
      c.req.param("id"),
      "viewer",
      "Reading activity",
    );
    return c.json(
      await appActivityPage(deps.db, {
        appId: access.app.id,
        ...bounded(() => parseEventRange(c.req.query("from"), c.req.query("to"))),
        channelId: c.req.query("channel_id") || undefined,
        category: category(c.req.query("category")),
        before: c.req.query("before") || undefined,
        limit: queryInt(c, "limit", 100, 1, 500),
      }),
    );
  });

  return router;
}
