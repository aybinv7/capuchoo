import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Hono, type Context } from "hono";
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

type Status = 400 | 401 | 405 | 429;

/** Answers a refused request and logs why, so a client that cannot connect is diagnosable. */
function refuse(c: Context<AppEnv>, status: Status, code: number, message: string) {
  c.get("logger").info("mcp request refused", {
    status,
    method: c.req.method,
    origin: c.req.header("origin") ?? null,
    user_agent: c.req.header("user-agent")?.slice(0, 120) ?? null,
    protocol: c.req.header("mcp-protocol-version") ?? null,
    has_authorization: Boolean(c.req.header("authorization") ?? c.req.header("x-api-key")),
  });
  return c.json({ jsonrpc: "2.0", error: { code, message }, id: null }, status);
}

/**
 * The Model Context Protocol endpoint: Streamable HTTP, stateless, JSON responses. Each request is
 * authenticated by an API key, rate limited per key, and answered by a fresh server, so it scales
 * like any other route. Cookies are never accepted, so a browser page cannot ride a dashboard
 * session; the key alone authorises, whatever origin hosted agents such as claude.ai call from.
 */
export function mcpRoutes() {
  const router = new Hono<AppEnv>();
  const limiter = new RateLimiter(BURST, PER_SECOND);

  router.all("/mcp", async (c) => {
    const who = c.get("principal");
    if (!who || who.credential.type !== "api_key") {
      c.header("WWW-Authenticate", challenge);
      return refuse(
        c,
        401,
        -32_001,
        "An API key is required: send it as `Authorization: Bearer cap_...`.",
      );
    }

    if (c.req.method !== "POST") {
      c.header("Allow", "POST");
      return refuse(c, 405, -32_000, "This server is stateless: send JSON-RPC requests with POST.");
    }

    const wait = limiter.take(who.credential.keyId);
    if (wait > 0) {
      c.header("Retry-After", String(wait));
      return refuse(c, 429, -32_000, "Too many requests for this API key; slow down.");
    }

    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(await readText(c, BODY_BYTES));
    } catch {
      return refuse(c, 400, -32_700, "The body is not JSON, or it is too large.");
    }

    const server = createMcpServer({ deps: c.get("deps"), principal: who, ip: c.get("clientIp") });
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
