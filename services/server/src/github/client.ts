import type { Deps } from "../http/context";
import { conflict } from "../lib/errors";
import { createAppJwt } from "./app-jwt";
import { githubApp, type GithubAppCredentials } from "./credentials";
import {
  githubCall,
  nextPage,
  type GithubRequest,
  type GithubResponse,
  type GithubTransport,
} from "./http";

const TOKEN_MARGIN_MS = 5 * 60_000;

/** A caller bound to one credential: the App itself, an installation, or a user. */
export interface GithubSession {
  call<T>(method: string, path: string, options?: Omit<GithubRequest, "token">): Promise<T | null>;
  raw<T>(
    method: string,
    path: string,
    options?: Omit<GithubRequest, "token">,
  ): Promise<GithubResponse<T | null>>;
  /** Every page of a list endpoint, up to `limit` items. */
  list<T>(
    path: string,
    options?: { query?: GithubRequest["query"]; key?: string; limit?: number },
  ): Promise<{ items: T[]; truncated: boolean }>;
}

export function transport(deps: Deps): GithubTransport {
  return {
    fetch: deps.ci.fetch,
    apiUrl: deps.config.GITHUB_API_URL,
    timeoutMs: deps.config.CI_REQUEST_TIMEOUT_MS,
  };
}

function session(deps: Deps, token: () => Promise<string>): GithubSession {
  const t = transport(deps);
  const raw = async <T>(method: string, path: string, options: Omit<GithubRequest, "token"> = {}) =>
    githubCall<T>(t, method, path, { ...options, token: await token() });
  return {
    raw,
    async call<T>(method: string, path: string, options?: Omit<GithubRequest, "token">) {
      return (await raw<T>(method, path, options)).data;
    },
    async list<T>(
      path: string,
      options: { query?: GithubRequest["query"]; key?: string; limit?: number } = {},
    ) {
      const limit = options.limit ?? 300;
      const items: T[] = [];
      let next: string | null = path;
      let query: GithubRequest["query"] = { per_page: 100, ...options.query };
      while (next && items.length < limit) {
        const page: GithubResponse<unknown> = await raw<unknown>("GET", next, { query });
        const data = page.data;
        const batch = (
          options.key ? (data as Record<string, unknown> | null)?.[options.key] : data
        ) as T[] | undefined;
        if (!Array.isArray(batch)) break;
        items.push(...batch);
        next = nextPage(page.headers);
        query = undefined;
      }
      return { items: items.slice(0, limit), truncated: Boolean(next) || items.length > limit };
    },
  };
}

/** The configured App, or a 409 the dashboard turns into "set up the GitHub App". */
export async function requireGithubApp(deps: Deps): Promise<GithubAppCredentials> {
  const app = await githubApp(deps);
  if (!app) throw conflict("No GitHub App is configured on this server", "github_not_configured");
  return app;
}

export async function asApp(deps: Deps): Promise<GithubSession> {
  const app = await requireGithubApp(deps);
  return session(deps, async () => createAppJwt(app.appId, app.privateKey, deps.now()));
}

async function mintInstallationToken(deps: Deps, installationId: string) {
  const app = await asApp(deps);
  const created = await app.call<{ token: string; expires_at: string }>(
    "POST",
    `/app/installations/${encodeURIComponent(installationId)}/access_tokens`,
  );
  if (!created?.token) throw conflict("GitHub did not issue an installation token", "github_token");
  return {
    token: created.token,
    expiresAt: Date.parse(created.expires_at) || deps.now().getTime() + 50 * 60_000,
  };
}

/** An installation token, reused until five minutes before it expires; concurrent callers share one mint. */
export async function installationToken(deps: Deps, installationId: string): Promise<string> {
  const now = deps.now().getTime();
  const cached = deps.ci.installationTokens.get(installationId);
  if (cached && cached.expiresAt - TOKEN_MARGIN_MS > now) return cached.token;
  let inflight = deps.ci.inflightTokens.get(installationId);
  if (!inflight) {
    inflight = mintInstallationToken(deps, installationId).finally(() =>
      deps.ci.inflightTokens.delete(installationId),
    );
    deps.ci.inflightTokens.set(installationId, inflight);
  }
  const minted = await inflight;
  deps.ci.installationTokens.set(installationId, minted);
  return minted.token;
}

export function asInstallation(deps: Deps, installationId: string): GithubSession {
  return session(deps, () => installationToken(deps, installationId));
}

export function asUser(deps: Deps, token: string): GithubSession {
  return session(deps, async () => token);
}

/** Exchanges an OAuth code from GitHub's redirect for a user token; used once and dropped. */
export async function exchangeUserCode(deps: Deps, code: string): Promise<string | null> {
  const app = await requireGithubApp(deps);
  if (!app.clientId || !app.clientSecret) return null;
  try {
    const response = await deps.ci.fetch(
      `${deps.config.GITHUB_WEB_URL.replace(/\/+$/, "")}/login/oauth/access_token`,
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "user-agent": "capuchoo-server",
        },
        body: JSON.stringify({ client_id: app.clientId, client_secret: app.clientSecret, code }),
        signal: AbortSignal.timeout(deps.config.CI_REQUEST_TIMEOUT_MS),
      },
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as { access_token?: unknown };
    return typeof payload.access_token === "string" ? payload.access_token : null;
  } catch {
    return null;
  }
}
