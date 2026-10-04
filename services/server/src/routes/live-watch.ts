import { Hono } from "hono";
import { requireApp } from "../access/app-access";
import { baseUrl } from "../http/body";
import { principal, type AppEnv } from "../http/context";
import { conflict, notFound } from "../lib/errors";
import { findDeviceById } from "../repositories/devices";
import { resolvedPolicyOf } from "../services/recording-policy";

/** Where a viewer opens its live socket: this server, never the dashboard's own origin. */
export const LIVE_SOCKET_PATH = "/api/live/ws";

/**
 * Watching a live device over a socket instead of waiting for its segments. Only a device its rules
 * already put live can be watched, so this shows nothing the recording would not.
 */
export function liveWatchRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.post("/devices/:id/watch", async (c) => {
    const deps = c.get("deps");
    const device = await findDeviceById(deps.db, c.req.param("id"));
    if (!device) throw notFound("Device");
    await requireApp(deps.db, principal(c), device.app_id, "viewer", "Watching a recording");
    const { policy } = await resolvedPolicyOf(deps, device);
    if (policy.mode !== "live") throw conflict("This device is not live", "not_live");
    const { room, ticket } = deps.watch.watch(device.app_id, device.device_id);
    const socket = new URL(LIVE_SOCKET_PATH, `${baseUrl(c)}/`);
    socket.protocol = socket.protocol === "https:" ? "wss:" : "ws:";
    return c.json({ room, ticket, socket_url: socket.toString() }, 201);
  });

  return router;
}
