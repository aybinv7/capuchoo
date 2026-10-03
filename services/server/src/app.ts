import { randomUUID } from "node:crypto";
import { RECORDING_ASSET_HEADER, RECORDING_HEADER } from "@capuchoo/core";
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { getConnInfo } from "@hono/node-server/conninfo";
import { authenticate } from "./auth/authenticate";
import type { AppEnv, Deps } from "./http/context";
import {
  HttpError,
  isCheckViolation,
  isForeignKeyViolation,
  isUniqueViolation,
} from "./lib/errors";
import { apiKeyRoutes } from "./routes/api-keys";
import { appRoutes } from "./routes/apps";
import { artefactRoutes } from "./routes/artefacts";
import { authRoutes } from "./routes/auth";
import { channelRoutes } from "./routes/channels";
import { ciRoutes } from "./routes/ci";
import { demoRoutes } from "./routes/demo";
import { deviceRoutes } from "./routes/device";
import { githubRoutes } from "./routes/github";
import { channelInsightRoutes } from "./routes/channel-insights";
import { deviceInsightRoutes } from "./routes/device-insights";
import { livePollRoutes } from "./routes/live-poll";
import { insightRoutes } from "./routes/insights";
import { organizationRoutes } from "./routes/organizations";
import { recordingDeviceRoutes } from "./routes/recording-device";
import { recordingRoutes } from "./routes/recordings";
import { sourceMapRoutes } from "./routes/source-maps";
import { systemRoutes } from "./routes/system";

const SECURITY_HEADERS: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "cross-origin-opener-policy": "same-origin",
};

/** Called by installed apps from their WebView origin; public and credential-free, so CORS is open. */
const DEVICE_PATHS = [
  "/api/update",
  "/api/stats",
  "/api/native-updates/log",
  "/api/channel_self",
  "/api/device_attributes",
  "/api/artefacts/*",
];

function clientIp(c: Context<AppEnv>, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded;
  }
  try {
    return getConnInfo(c as never).remote.address ?? "unknown";
  } catch {
    return "unknown";
  }
}

function toHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;
  const code =
    typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;
  if (code === "22P02") return new HttpError(404, "Not found", "not_found");
  if (isUniqueViolation(error)) return new HttpError(409, "That already exists", "conflict");
  if (isForeignKeyViolation(error))
    return new HttpError(409, "Still referenced by other records", "in_use");
  if (isCheckViolation(error))
    return new HttpError(400, "A value is outside what is allowed", "invalid_value");
  return new HttpError(500, "Internal server error", "internal");
}

/** Builds the HTTP application. `deps` is injected so tests run it against PGlite and memory storage. */
export function createApp(deps: Deps): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use("*", async (c, next) => {
    const requestId = c.req.header("x-request-id")?.slice(0, 64) || randomUUID();
    c.set("deps", deps);
    c.set("requestId", requestId);
    c.set("clientIp", clientIp(c, deps.config.TRUST_PROXY));
    c.set("logger", deps.logger.child({ request_id: requestId }));
    c.set("principal", null);
    const started = performance.now();
    await next();
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) c.header(name, value);
    c.header("x-request-id", requestId);
    if (deps.config.NODE_ENV === "production" && new URL(c.req.url).protocol === "https:") {
      c.header("strict-transport-security", "max-age=31536000; includeSubDomains");
    }
    const elapsed = Math.round(performance.now() - started);
    const shed = c.res.status === 503 && c.res.headers.has("retry-after");
    if ((c.res.status >= 500 && !shed) || elapsed > 2000) {
      c.get("logger").warn("slow or failed request", {
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        ms: elapsed,
      });
    }
  });

  app.onError((error, c) => {
    const http = toHttpError(error);
    if (http.status >= 500 && http.reason !== "busy")
      c.get("logger")?.error("request failed", { error, path: c.req.path, method: c.req.method });
    if ((http.status === 429 || http.status === 503) && http.details?.retry_after)
      c.header("retry-after", String(http.details.retry_after));
    return c.json(
      { error: http.message, reason: http.reason ?? "error", ...http.details },
      http.status as 400,
    );
  });

  app.route("/", systemRoutes());
  const devices = cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    maxAge: 86400,
  });
  for (const path of DEVICE_PATHS) app.use(path, devices);
  app.use(
    "/api/recording/*",
    cors({
      origin: "*",
      allowMethods: ["POST", "OPTIONS"],
      allowHeaders: ["Content-Type", RECORDING_HEADER, RECORDING_ASSET_HEADER],
      maxAge: 86400,
    }),
  );
  app.use("/api/*", authenticate);
  app.route("/api", deviceRoutes());
  app.route("/api", recordingDeviceRoutes());
  app.route("/api/auth", authRoutes());
  app.route("/api/api-keys", apiKeyRoutes());
  app.route("/api/organizations", organizationRoutes());
  app.route("/api/apps", appRoutes());
  app.route("/api", channelRoutes());
  app.route("/api", artefactRoutes());
  app.route("/api", insightRoutes());
  app.route("/api", deviceInsightRoutes());
  app.route("/api", channelInsightRoutes());
  app.route("/api", livePollRoutes());
  app.route("/api", ciRoutes());
  app.route("/api", githubRoutes());
  app.route("/api", demoRoutes());
  app.route("/api", recordingRoutes());
  app.route("/api", sourceMapRoutes());
  app.get("/api/health", (c) => c.json({ status: "ok" }));
  app.all("/api/*", (c) => c.json({ error: "Not found", reason: "not_found" }, 404));

  return app;
}
