import { Hono } from "hono";
import { requireApp } from "../access/app-access";
import { queryInt } from "../http/body";
import { principal, type AppEnv } from "../http/context";
import { badRequest, notFound } from "../lib/errors";
import { findDeviceById } from "../repositories/devices";
import {
  appActivityPage,
  deviceDetail,
  deviceEventPage,
  parseCategory,
} from "../services/device-detail";

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
    return c.json(await deviceDetail(deps.db, device, deps.now()));
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
        category: category(c.req.query("category")),
        before: c.req.query("before") || undefined,
        limit: queryInt(c, "limit", 100, 1, 500),
      }),
    );
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
        channelId: c.req.query("channel_id") || undefined,
        category: category(c.req.query("category")),
        before: c.req.query("before") || undefined,
        limit: queryInt(c, "limit", 100, 1, 500),
      }),
    );
  });

  return router;
}
