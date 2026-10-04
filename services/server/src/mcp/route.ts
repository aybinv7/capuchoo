import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Hono } from "hono";
import type { AppEnv } from "../http/context";
import { readText } from "../http/body";
import { RateLimiter } from "../lib/rate-limit";
import { createMcpServer } from "./server";

/** An agent can be chatty; this lets a long investigation run and stops a loop from hammering. */
const BURST = 120;
const PER_SECOND = 4;
/** JSON-RPC requests carry tool arguments, never files. */
const BODY_BYTES = 256 * 1024;

const challenge = 'Bearer realm="capuchoo", error="invalid_token"';

const jsonRpcError = (code: number, message: string) => ({
  jsonrpc: "2.0",
  error: { code, message },
  id: null,
});

/**
 * The Model Context Protocol endpoint: Streamable HTTP, stateless, JSON responses. Each request is
 * authenticated by an API key, rate limited per key, and answered by a fresh server, so it scales
 * like any other route. Browsers may only call it from an allowed origin (DNS rebinding).
 */
export function mcpRoutes() {
  const router = new Hono<AppEnv>();
  const limiter = new RateLimiter(BURST, PER_SECOND);

  router.all("/mcp", async (c) => {
    const deps = c.get("deps");
    const origin = c.req.header("origin");
    if (
      origin &&
      !deps.config.allowedOrigins.includes(origin) &&
      origin !== deps.config.PUBLIC_URL?.replace(/\/+$/, "")
    ) {
      return c.json(jsonRpcError(-32_000, "Origin not allowed"), 403);
    }

    const who = c.get("principal");
    if (!who || who.credential.type !== "api_key") {
      c.header("WWW-Authenticate", challenge);
      return c.json(
        jsonRpcError(
          -32_001,
          "An API key is required: send it as `Authorization: Bearer cap_...`.",
        ),
        401,
      );
    }

    if (c.req.method !== "POST") {
      c.header("Allow", "POST");
      return c.json(
        jsonRpcError(-32_000, "This server is stateless: send JSON-RPC requests with POST."),
        405,
      );
    }

    const wait = limiter.take(who.credential.keyId);
    if (wait > 0) {
      c.header("Retry-After", String(wait));
      return c.json(jsonRpcError(-32_000, "Too many requests for this API key; slow down."), 429);
    }

    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(await readText(c, BODY_BYTES));
    } catch {
      return c.json(jsonRpcError(-32_700, "The body is not JSON, or it is too large."), 400);
    }

    const server = createMcpServer({ deps, principal: who, ip: c.get("clientIp") });
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    try {
      await server.connect(transport);
      return await transport.handleRequest(c.req.raw, { parsedBody });
    } finally {
      void transport.close().catch(() => undefined);
      void server.close().catch(() => undefined);
    }
  });

  return router;
}
