import { createApp } from "../src/app";
import { API_KEY_PREFIX, SESSION_PREFIX } from "../src/auth/tokens";
import { loadConfig } from "../src/config";
import type { Db } from "../src/db/database";
import type { Deps } from "../src/http/context";
import { BackgroundTasks } from "../src/lib/background";
import { hashPassword, randomToken, sha256Hex } from "../src/lib/crypto";
import { silentLogger } from "../src/lib/logger";
import { createApiKey } from "../src/repositories/api-keys";
import { createSession } from "../src/repositories/sessions";
import { createUser } from "../src/repositories/users";
import { EventHub } from "../src/services/event-hub";
import { RequestCache } from "../src/services/request-cache";
import { createPostgresStorage } from "../src/storage/postgres";
import { createTestDatabase } from "./database";
import type { AppRole } from "@capuchoo/core";

export const BASE = "http://capuchoo.test";

export interface TestContext {
  deps: Deps;
  db: Db;
  app: ReturnType<typeof createApp>;
  request(path: string, init?: RequestInit & { token?: string; json?: unknown }): Promise<Response>;
  user(
    email: string,
    options?: { admin?: boolean },
  ): Promise<{ id: string; token: string; email: string }>;
  key(userId: string, options?: { appId?: string | null; role?: AppRole | null }): Promise<string>;
  close(): Promise<void>;
}

export async function createTestContext(
  overrides: Record<string, string> = {},
): Promise<TestContext> {
  const db = await createTestDatabase();
  const config = loadConfig({
    NODE_ENV: "test",
    DATABASE_URL: "pglite://memory",
    SECRET_KEY: "test-secret-key-that-is-long-enough-000",
    PUBLIC_URL: BASE,
    STORAGE_DRIVER: "postgres",
    ...overrides,
  });
  let clock = Date.now();
  const deps: Deps = {
    db,
    config,
    storage: createPostgresStorage(db),
    logger: silentLogger,
    hub: new EventHub(),
    cache: new RequestCache(0),
    tasks: new BackgroundTasks(silentLogger),
    now: () => new Date(clock),
  };
  const app = createApp(deps);

  const context: TestContext = {
    deps,
    db,
    app,
    async request(path, init = {}) {
      const headers = new Headers(init.headers);
      if (init.token) headers.set("authorization", `Bearer ${init.token}`);
      let body = init.body;
      if (init.json !== undefined) {
        headers.set("content-type", "application/json");
        body = JSON.stringify(init.json);
      }
      const response = await app.request(`${BASE}${path}`, { ...init, headers, body });
      await deps.tasks.idle();
      return response;
    },
    async user(email, options = {}) {
      const user = await createUser(db, {
        email,
        passwordHash: await hashPassword("correct horse battery staple"),
        isInstanceAdmin: options.admin ?? false,
      });
      const token = randomToken(SESSION_PREFIX);
      await createSession(db, {
        userId: user.id,
        tokenHash: sha256Hex(token),
        expiresAt: new Date(Date.now() + 86_400_000),
        ip: null,
        userAgent: null,
      });
      return { id: user.id, token, email: user.email };
    },
    async key(userId, options = {}) {
      const key = randomToken(API_KEY_PREFIX);
      await createApiKey(db, {
        userId,
        name: "test",
        keyHash: sha256Hex(key),
        keyPrefix: key.slice(0, 12),
        appId: options.appId ?? null,
        role: options.role ?? null,
        expiresAt: null,
      });
      return key;
    },
    async close() {
      await deps.tasks.idle();
      await db.destroy();
    },
  };
  void clock;
  return context;
}

/** An organization with an app and dev/staging/prod channels, owned by `owner`. */
export async function seedApp(ctx: TestContext, ownerToken: string, bundleId = "com.acme.app") {
  const org = await (
    await ctx.request("/api/organizations", {
      method: "POST",
      token: ownerToken,
      json: { name: `Org ${bundleId}` },
    })
  ).json();
  const app = await (
    await ctx.request("/api/apps", {
      method: "POST",
      token: ownerToken,
      json: { name: "Acme", app_id: bundleId, platform: "android", organization_id: org.id },
    })
  ).json();
  const channels: Record<string, { id: string; name: string }> = {};
  for (const environment of ["dev", "staging", "prod"]) {
    channels[environment] = await (
      await ctx.request("/api/dashboard/channels", {
        method: "POST",
        token: ownerToken,
        json: { app_id: app.id, name: environment, environment },
      })
    ).json();
  }
  return { org, app, channels };
}

/** A minimal valid zip: local header magic and some bytes, which is all the server checks. */
export function fakeZip(seed: string): Blob {
  const body = new TextEncoder().encode(`${seed}-${"x".repeat(2048)}`);
  const bytes = new Uint8Array(4 + body.length);
  bytes.set([0x50, 0x4b, 0x03, 0x04], 0);
  bytes.set(body, 4);
  return new Blob([bytes]);
}

export function uploadForm(
  fields: Record<string, string>,
  file: Blob,
  name = "bundle.zip",
): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  form.append("bundle", file, name);
  return form;
}
