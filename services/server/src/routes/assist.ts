import { Hono } from "hono";
import { requireApp } from "../access/app-access";
import { baseUrl } from "../http/body";
import { principal, type AppEnv } from "../http/context";
import { notFound } from "../lib/errors";
import { findDeviceById } from "../repositories/devices";
import { listAssets } from "../repositories/recording-assets";
import { serializeRecordingAsset } from "../http/recording-serializers";
import { describeSession, type AssistSession } from "../services/assist/registry";
import type { Deps } from "../http/context";

/** The files the device's screen references, so the agent's view is styled like the app. */
async function assetsFor(deps: Deps, session: AssistSession) {
  if (!session.versionName) return [];
  return (await listAssets(deps.db, session.appId, session.versionName)).map(
    serializeRecordingAsset,
  );
}

/** Where the dashboard opens its assist socket: this server, never the dashboard's own origin. */
export const ASSIST_SOCKET_PATH = "/api/assist/ws";

/**
 * Starting, watching and ending an assist session. Testers and above may assist: the user still
 * has to accept on their screen, and accept again before anyone controls the app.
 */
export function assistRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.post("/devices/:id/assist", async (c) => {
    const deps = c.get("deps");
    const who = principal(c);
    const device = await findDeviceById(deps.db, c.req.param("id"));
    if (!device) throw notFound("Device");
    const access = await requireApp(deps.db, who, device.app_id, "tester", "Assisting a device");
    const { session, agentTicket } = deps.assist.request({
      appId: device.app_id,
      organizationId: access.app.organization_id,
      deviceUuid: device.id,
      deviceId: device.device_id,
      versionName: device.version_name,
      agent: {
        userId: who.userId,
        apiKeyId: who.credential.type === "api_key" ? who.credential.keyId : null,
        name: who.fullName?.trim() || who.email.split("@")[0] || "Support",
      },
    });
    const socket = new URL(ASSIST_SOCKET_PATH, `${baseUrl(c)}/`);
    socket.protocol = socket.protocol === "https:" ? "wss:" : "ws:";
    return c.json(
      {
        session: describeSession(session),
        ticket: agentTicket,
        socket_url: socket.toString(),
        assets: await assetsFor(deps, session),
      },
      201,
    );
  });

  router.get("/assist/:id", async (c) => {
    const deps = c.get("deps");
    const session = deps.assist.get(c.req.param("id"));
    if (!session) throw notFound("Assist session");
    await requireApp(deps.db, principal(c), session.appId, "tester", "Assisting a device");
    return c.json({ session: describeSession(session), assets: await assetsFor(deps, session) });
  });

  router.delete("/assist/:id", async (c) => {
    const deps = c.get("deps");
    const session = deps.assist.get(c.req.param("id"));
    if (!session) throw notFound("Assist session");
    await requireApp(deps.db, principal(c), session.appId, "tester", "Assisting a device");
    deps.assist.end(session.id, "agent");
    return c.body(null, 204);
  });

  return router;
}
