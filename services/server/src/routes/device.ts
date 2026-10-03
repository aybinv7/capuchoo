import { Hono, type MiddlewareHandler } from "hono";
import type { AppContext, AppEnv } from "../http/context";
import { baseUrl, readJson } from "../http/body";
import { badRequest, tooManyRequests } from "../lib/errors";
import { RateLimiter } from "../lib/rate-limit";
import { findAppByBundleId } from "../repositories/apps";
import { listChannels } from "../repositories/channels";
import { normaliseDeviceAttributes } from "@capuchoo/core";
import {
  findDevice,
  setDeviceAttributes,
  setSelfChannel,
  upsertDevice,
} from "../repositories/devices";
import { publishDevice } from "../services/live-events";
import { parseDeviceRequest } from "../services/device-request";
import { recordEvents } from "../services/telemetry";
import { checkForUpdate } from "../services/update-check";

const DEVICE_BODY_BYTES = 64 * 1024;

const guarded: MiddlewareHandler<AppEnv> = (c, next) => c.get("deps").load.run(next);

/** The endpoints installed apps call. Unauthenticated by design; bounded by size and rate. */
export function deviceRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();
  const perDevice = new RateLimiter(30, 0.5);
  const perIp = new RateLimiter(600, 10);

  router.use("*", async (c, next) => {
    const waitIp = perIp.take(c.get("clientIp"));
    if (waitIp) throw tooManyRequests(waitIp);
    return next();
  });

  router.post("/update", guarded, async (c) => {
    const request = parseDeviceRequest(await readJson(c, DEVICE_BODY_BYTES));
    if (!request) throw badRequest("app_id and device_id are required");
    const wait = perDevice.take(`${request.appId}:${request.deviceId}`);
    if (wait) throw tooManyRequests(wait);
    const result = await checkForUpdate(c.get("deps"), request, baseUrl(c));
    return c.json(result.response);
  });

  router.post("/stats", guarded, async (c) => {
    const body = await readJson<unknown>(c, DEVICE_BODY_BYTES * 4);
    const result = await recordEvents(c.get("deps"), body, { native: false });
    return c.json({ status: "success", ...result });
  });

  router.post("/native-updates/log", async (c) => {
    const body = await readJson<unknown>(c, DEVICE_BODY_BYTES);
    const result = await recordEvents(c.get("deps"), body, { native: true });
    return c.json({ status: "success", ...result });
  });

  const selfChannel = async (c: AppContext, choose: boolean) => {
    const deps = c.get("deps");
    const raw =
      c.req.method === "GET" || c.req.method === "DELETE"
        ? Object.fromEntries(new URL(c.req.url).searchParams)
        : await readJson(c, DEVICE_BODY_BYTES);
    const request = parseDeviceRequest(raw);
    if (!request) throw badRequest("app_id and device_id are required");
    const identity = await findAppByBundleId(deps.db, request.appId);
    if (!identity) return c.json({ status: "error", error: "App not found" }, 404);
    const channels = await listChannels(deps.db, identity.app.id);

    if (c.req.method === "GET") {
      const device = await findDevice(deps.db, identity.app.id, request.deviceId);
      const current = channels.find(
        (channel) =>
          channel.id ===
          (device?.assigned_channel_id ?? device?.self_channel_id ?? device?.channel_id),
      );
      return c.json({
        channel: current?.name ?? request.defaultChannel ?? null,
        status: current ? "override" : "default",
        allowSet: channels.some((channel) => channel.allow_device_self_set),
        channels: channels
          .filter((channel) => channel.is_public || channel.allow_device_self_set)
          .map((channel) => ({
            id: channel.id,
            name: channel.name,
            public: channel.is_public,
            allow_self_set: channel.allow_device_self_set,
          })),
      });
    }

    const device = await upsertDevice(
      deps.db,
      { appId: identity.app.id, deviceId: request.deviceId, platform: request.platform },
      deps.now(),
    );

    if (!choose) {
      await setSelfChannel(deps.db, device.id, null);
      deps.cache.invalidate(`app:${identity.app.id}`);
      return c.json({ status: "ok", message: "Channel choice cleared" });
    }

    const wanted = request.channel;
    const channel = channels.find((candidate) => candidate.name === wanted);
    if (!channel)
      return c.json({ status: "error", error: `Channel "${wanted ?? ""}" not found` }, 404);
    if (!channel.allow_device_self_set) {
      return c.json(
        { status: "error", error: `Channel "${channel.name}" does not allow devices to choose it` },
        403,
      );
    }
    await setSelfChannel(deps.db, device.id, channel.id);
    deps.cache.invalidate(`app:${identity.app.id}`);
    return c.json({ status: "ok", message: `Device moved to ${channel.name}` });
  };

  router.post("/device_attributes", async (c) => {
    const deps = c.get("deps");
    const body = await readJson(c, DEVICE_BODY_BYTES);
    const request = parseDeviceRequest(body);
    if (!request) throw badRequest("app_id and device_id are required");
    const wait = perDevice.take(`${request.appId}:${request.deviceId}`);
    if (wait) throw tooManyRequests(wait);
    const parsed = normaliseDeviceAttributes(body.attributes);
    if (!parsed) throw badRequest("attributes must be an object");
    const identity = await findAppByBundleId(deps.db, request.appId);
    if (!identity) return c.json({ status: "error", error: "App not found" }, 404);
    const device = await setDeviceAttributes(
      deps.db,
      identity.app.id,
      request.deviceId,
      parsed.attributes,
      deps.now(),
    );
    if (!device) return c.json({ status: "error", error: "Device not seen yet" }, 404);
    publishDevice(deps, identity.app.id, {
      device_uuid: device.id,
      device_id: device.device_id,
      channel_id: device.channel_id,
      event: "attributes",
      status: null,
      version: device.version_name,
      version_code: device.version_code,
      model: device.model,
      at: deps.now().toISOString(),
    });
    return c.json({ status: "ok", attributes: parsed.attributes, dropped: parsed.dropped });
  });

  router.get("/channel_self", (c) => selfChannel(c, true));
  router.post("/channel_self", (c) => selfChannel(c, true));
  router.put("/channel_self", (c) => selfChannel(c, true));
  router.delete("/channel_self", (c) => selfChannel(c, false));

  return router;
}
