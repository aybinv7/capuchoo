import { generateKeyPairSync } from "node:crypto";
import { hmacHex } from "../src/lib/crypto";

export interface RecordedCall {
  method: string;
  url: URL;
  body: unknown;
  headers: Headers;
}

type Handler = (call: RecordedCall) => {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
};

/** A scripted HTTP upstream: routes are `METHOD /path` with `:param` segments; every call is kept. */
export class FakeProvider {
  readonly calls: RecordedCall[] = [];
  private readonly routes: Array<{ method: string; pattern: RegExp; handler: Handler }> = [];

  on(route: string, handler: Handler | { status?: number; body?: unknown }): this {
    const [method, path] = route.split(" ");
    const pattern = new RegExp(
      `^${path!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/:\w+/g, "[^/]+")}$`,
    );
    this.routes.unshift({
      method: method!,
      pattern,
      handler: typeof handler === "function" ? handler : () => handler,
    });
    return this;
  }

  calledWith(route: string): RecordedCall[] {
    const [method, path] = route.split(" ");
    return this.calls.filter((call) => call.method === method && call.url.pathname === path);
  }

  readonly fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    const method = (init?.method ?? "GET").toUpperCase();
    const text = typeof init?.body === "string" ? init.body : null;
    const call: RecordedCall = {
      method,
      url,
      body: text ? JSON.parse(text) : null,
      headers: new Headers(init?.headers),
    };
    this.calls.push(call);
    const route = this.routes.find(
      (entry) => entry.method === method && entry.pattern.test(url.pathname),
    );
    if (!route)
      return new Response(JSON.stringify({ message: `no fake for ${method} ${url.pathname}` }), {
        status: 404,
      });
    const result = route.handler(call);
    const status = result.status ?? 200;
    const body =
      status === 204
        ? null
        : typeof result.body === "string"
          ? result.body
          : JSON.stringify(result.body ?? {});
    return new Response(body, {
      status,
      headers: { "content-type": "application/json", ...result.headers },
    });
  };
}

export const WEBHOOK_SECRET = "test-webhook-secret-0123456789";

/** Environment that configures a GitHub App for a test context, with a fresh RSA key. */
export function githubAppEnv(): Record<string, string> {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return {
    GITHUB_APP_ID: "4242",
    GITHUB_APP_SLUG: "capuchoo-test",
    GITHUB_APP_PRIVATE_KEY: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    GITHUB_WEBHOOK_SECRET: WEBHOOK_SECRET,
    GITHUB_CLIENT_ID: "Iv1.test",
    GITHUB_CLIENT_SECRET: "client-secret",
  };
}

/** Headers GitHub sends with a signed delivery. */
export function githubDelivery(event: string, payload: unknown, secret = WEBHOOK_SECRET) {
  const body = JSON.stringify(payload);
  return {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      "x-github-event": event,
      "x-hub-signature-256": `sha256=${hmacHex(secret, body)}`,
    },
  };
}
