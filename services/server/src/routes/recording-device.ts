import { Hono, type MiddlewareHandler } from "hono";
import {
  RECORDING_ASSET_HEADER,
  RECORDING_HEADER,
  RECORDING_WIRE_LIMITS,
  parseRecordingAssetHeader,
  parseRecordingPolicyRequest,
  parseRecordingSegmentHeader,
} from "@capuchoo/core";
import { GZIP_MAGIC, meteredBody } from "../http/binary-body";
import { readJson } from "../http/body";
import type { AppEnv } from "../http/context";
import { badRequest, tooManyRequests } from "../lib/errors";
import { RateLimiter } from "../lib/rate-limit";
import { ingestAsset, ingestSegment } from "../services/recording-ingest";
import { HealthGate, noteRecorderHealth } from "../services/recorder-health";
import { listenForPolicy } from "../services/recording-policy";

/** Under the 60 s idle timeout most proxies, Render's included, apply to a quiet connection. */
const MAX_LISTEN_SECONDS = 55;

const guarded: MiddlewareHandler<AppEnv> = (c, next) => c.get("deps").load.run(next);

/** What a recording device calls. Unauthenticated like every device route; bounded by size and rate. */
export function recordingDeviceRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();
  const perIp = new RateLimiter(1200, 20);
  const policyPerDevice = new RateLimiter(10, 0.1);
  const segmentsPerDevice = new RateLimiter(120, 2);
  const assetsPerDevice = new RateLimiter(60, 0.5);
  const health = new HealthGate();

  router.use("*", async (c, next) => {
    const wait = perIp.take(c.get("clientIp"));
    if (wait) throw tooManyRequests(wait);
    return next();
  });

  router.post("/recording/policy", async (c) => {
    c.get("deps").load.check();
    const body = await readJson(c, 8 * 1024);
    const request = parseRecordingPolicyRequest(body);
    if (!request) throw badRequest("appId, deviceId and platform are required");
    const wait = policyPerDevice.take(`${request.appId}:${request.deviceId}`);
    if (wait) throw tooManyRequests(wait);
    const listen =
      typeof body.wait === "number" && Number.isFinite(body.wait)
        ? Math.min(MAX_LISTEN_SECONDS, Math.max(0, body.wait)) * 1000
        : 0;
    const deps = c.get("deps");
    const seen = typeof body.assist_seen === "string" ? body.assist_seen : null;
    const seenWatch = typeof body.watch_seen === "string" ? body.watch_seen : null;
    const answer = await listenForPolicy(
      deps,
      request,
      listen,
      c.req.raw.signal,
      (first) => {
        if (first.status !== "unknown_app") noteRecorderHealth(deps, health, first, request);
      },
      seen,
      seenWatch,
    );
    if (answer.status === "unknown_app") return c.json({ error: "App not found" }, 404);
    const invite = deps.assist.inviteFor(answer.appId, request.deviceId);
    const watch = deps.watch.inviteFor(answer.appId, request.deviceId);
    const extra = { ...(invite ? { assist: invite } : {}), ...(watch ? { watch } : {}) };
    if (answer.status === "unchanged") {
      return c.json({ unchanged: true, version: answer.version, ...extra });
    }
    return c.json({ policy: answer.policy, known_assets: answer.knownAssets, ...extra });
  });

  router.post("/recording/assist/decline", async (c) => {
    const body = await readJson(c, 2 * 1024);
    if (typeof body.session !== "string" || typeof body.ticket !== "string") {
      throw badRequest("session and ticket are required");
    }
    const declined = c.get("deps").assist.decline(body.session, body.ticket);
    return c.json({ declined }, declined ? 200 : 404);
  });

  router.post("/recording/segments", guarded, async (c) => {
    const header = parseRecordingSegmentHeader(c.req.header(RECORDING_HEADER));
    if (!header) throw badRequest(`A valid ${RECORDING_HEADER} header is required`, "bad_header");
    const wait = segmentsPerDevice.take(`${header.session.appId}:${header.session.deviceId}`);
    if (wait) throw tooManyRequests(wait);
    const body = meteredBody(c, RECORDING_WIRE_LIMITS.segmentBytes, GZIP_MAGIC, () =>
      badRequest("A segment must be gzip", "not_gzip"),
    );
    const outcome = await ingestSegment(c.get("deps"), header, body);
    if (outcome.status === "unknown_app") return c.json({ error: "App not found" }, 404);
    return c.json(
      { status: outcome.status, seq: header.segment.seq },
      outcome.status === "stored" ? 201 : 200,
    );
  });

  router.post("/recording/assets", guarded, async (c) => {
    const header = parseRecordingAssetHeader(c.req.header(RECORDING_ASSET_HEADER));
    if (!header)
      throw badRequest(`A valid ${RECORDING_ASSET_HEADER} header is required`, "bad_header");
    const wait = assetsPerDevice.take(`${header.appId}:${c.get("clientIp")}`);
    if (wait) throw tooManyRequests(wait);
    const body = meteredBody(c, RECORDING_WIRE_LIMITS.assetBytes, null);
    const outcome = await ingestAsset(c.get("deps"), header, body);
    if (outcome.status === "unknown_app") return c.json({ error: "App not found" }, 404);
    return c.json({ status: outcome.status }, outcome.status === "stored" ? 201 : 200);
  });

  return router;
}
