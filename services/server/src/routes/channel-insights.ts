import { Hono } from "hono";
import { requireApp } from "../access/app-access";
import { principal, type AppEnv, type AppContext } from "../http/context";
import { badRequest, notFound } from "../lib/errors";
import { findChannel } from "../repositories/channels";
import { activityOf } from "../services/activity";
import { channelRollout } from "../services/channel-rollout";
import { EventRangeError, isTimeZone, parseActivityQuery } from "../services/event-range";

async function readableChannel(c: AppContext) {
  const deps = c.get("deps");
  const channel = await findChannel(deps.db, c.req.param("id") ?? "");
  if (!channel) throw notFound("Channel");
  await requireApp(deps.db, principal(c), channel.app_id, "viewer", "Reading a channel");
  return channel;
}

/** How a channel's release is landing, and what its devices reported over a window. */
export function channelInsightRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get("/channels/:id/activity", async (c) => {
    const channel = await readableChannel(c);
    let query;
    try {
      query = parseActivityQuery({
        from: c.req.query("from"),
        to: c.req.query("to"),
        bucket: c.req.query("bucket"),
        tz: c.req.query("tz"),
      });
    } catch (error) {
      if (error instanceof EventRangeError) throw badRequest(error.message);
      throw error;
    }
    return c.json(await activityOf(c.get("deps").db, { channelId: channel.id }, query));
  });

  router.get("/channels/:id/rollout", async (c) => {
    const channel = await readableChannel(c);
    const tz = c.req.query("tz") || "UTC";
    if (tz.length > 64 || !isTimeZone(tz))
      throw badRequest(`unknown time zone "${tz.slice(0, 64)}"`);
    const deps = c.get("deps");
    return c.json(await channelRollout(deps.db, channel, tz, deps.now()));
  });

  return router;
}
