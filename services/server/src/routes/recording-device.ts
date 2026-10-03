import { Hono } from "hono";
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
import { policyForDevice } from "../services/recording-policy";

/** What a recording device calls. Unauthenticated like every device route; bounded by size and rate. */
export function recordingDeviceRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();
  const perIp = new RateLimiter(1200, 20);
  const policyPerDevice = new RateLimiter(10, 0.1);
  const segmentsPerDevice = new RateLimiter(120, 2);
  const assetsPerDevice = new RateLimiter(60, 0.5);

  router.use("*", async (c, next) => {
    const wait = perIp.take(c.get("clientIp"));
    if (wait) throw tooManyRequests(wait);
    return next();
  });

  router.post("/recording/policy", async (c) => {
    const request = parseRecordingPolicyRequest(await readJson(c, 8 * 1024));
    if (!request) throw badRequest("appId, deviceId and platform are required");
    const wait = policyPerDevice.take(`${request.appId}:${request.deviceId}`);
    if (wait) throw tooManyRequests(wait);
    const answer = await policyForDevice(c.get("deps"), request);
    if (answer.status === "unknown_app") return c.json({ error: "App not found" }, 404);
    if (answer.status === "unchanged") return c.json({ unchanged: true, version: answer.version });
    return c.json({ policy: answer.policy, known_assets: answer.knownAssets });
  });

  router.post("/recording/segments", async (c) => {
    const header = parseRecordingSegmentHeader(c.req.header(RECORDING_HEADER));
    if (!header) throw badRequest(`A valid ${RECORDING_HEADER} header is required`, "bad_header");
    const wait = segmentsPerDevice.take(`${header.session.appId}:${header.session.deviceId}`);
    if (wait) throw tooManyRequests(wait);
    const body = meteredBody(
      c,
      RECORDING_WIRE_LIMITS.segmentBytes,
      GZIP_MAGIC,
      badRequest("A segment must be gzip", "not_gzip"),
    );
    const outcome = await ingestSegment(c.get("deps"), header, body);
    if (outcome.status === "unknown_app") return c.json({ error: "App not found" }, 404);
    return c.json(
      { status: outcome.status, seq: header.segment.seq },
      outcome.status === "stored" ? 201 : 200,
    );
  });

  router.post("/recording/assets", async (c) => {
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
