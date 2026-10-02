import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { Deps } from "../http/context";
import { HttpError, badRequest } from "../lib/errors";

export interface GitlabTarget {
  baseUrl: string;
  project: string;
  token: string;
}

const PRIVATE_V4 = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
];

function isPrivateHost(host: string): boolean {
  const bare = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    bare === "localhost" ||
    bare.endsWith(".localhost") ||
    bare.endsWith(".internal") ||
    bare.endsWith(".local")
  )
    return true;
  const family = isIP(bare);
  if (family === 4) return PRIVATE_V4.some((range) => range.test(bare));
  if (family === 6)
    return (
      bare === "::1" ||
      bare.startsWith("fc") ||
      bare.startsWith("fd") ||
      bare.startsWith("fe80") ||
      bare === "::"
    );
  return false;
}

/**
 * The GitLab base URL an app admin may point the server at. The server calls it with a token, so
 * it must be https and, unless an operator allow-listed hosts, not a private or loopback address -
 * an app admin is not trusted to aim the server at its own network.
 */
export function validateGitlabBaseUrl(deps: Deps, value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw badRequest("base_url is required");
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw badRequest("base_url is not a URL");
  }
  if (url.username || url.password || url.search || url.hash)
    throw badRequest("base_url must be a plain origin");
  const allowed = deps.config.GITLAB_ALLOWED_HOSTS.split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length > 0) {
    if (!allowed.includes(url.host.toLowerCase()))
      throw badRequest(`${url.host} is not an allowed GitLab host`, "gitlab_host");
  } else {
    if (url.protocol !== "https:") throw badRequest("base_url must use https", "gitlab_host");
    if (isPrivateHost(url.hostname))
      throw badRequest("base_url points at a private address", "gitlab_host");
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

/** Resolves the host before each call, so a name that points at a private address is refused too. */
async function assertPublicTarget(deps: Deps, url: URL): Promise<void> {
  if (deps.config.GITLAB_ALLOWED_HOSTS.trim()) return;
  if (isPrivateHost(url.hostname)) throw new GitlabApiError(400, "the host is a private address");
  const addresses = await lookup(url.hostname, { all: true }).catch(() => []);
  if (addresses.length === 0) throw new GitlabApiError(502, "the host does not resolve");
  if (addresses.some((entry) => isPrivateHost(entry.address))) {
    throw new GitlabApiError(400, "the host resolves to a private address");
  }
}

/** A GitLab refusal carried to the caller with GitLab's own message. */
export class GitlabApiError extends HttpError {
  constructor(upstreamStatus: number, message: string) {
    super(
      [400, 403, 404, 409, 422].includes(upstreamStatus) ? upstreamStatus : 502,
      `GitLab: ${message}`,
      "gitlab_error",
      {
        upstream_status: upstreamStatus,
      },
    );
  }
}

function messageOf(payload: unknown, status: number): string {
  const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const message = record.message ?? record.error;
  if (typeof message === "string") return message.slice(0, 300);
  if (message && typeof message === "object") return JSON.stringify(message).slice(0, 300);
  return `HTTP ${status}`;
}

/** One GitLab REST call against `/api/v4`, with a timeout and a bounded body. */
export async function gitlabCall<T>(
  deps: Deps,
  target: GitlabTarget,
  method: string,
  path: string,
  options: { body?: unknown; query?: Record<string, string | number>; text?: boolean } = {},
): Promise<T> {
  const url = new URL(
    `${target.baseUrl}/api/v4/projects/${encodeURIComponent(target.project)}${path}`,
  );
  for (const [key, value] of Object.entries(options.query ?? {}))
    url.searchParams.set(key, String(value));
  await assertPublicTarget(deps, url);
  let response: Response;
  try {
    response = await deps.ci.fetch(url, {
      method,
      redirect: "error",
      headers: {
        "private-token": target.token,
        accept: "application/json",
        ...(options.body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(deps.config.CI_REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new GitlabApiError(502, "unreachable from the Capuchoo server");
  }
  const text = await response.text();
  if (options.text && response.ok) return text.slice(0, 4 * 1024 * 1024) as T;
  if (text.length > 4 * 1024 * 1024) throw new GitlabApiError(502, "response too large");
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  if (!response.ok) throw new GitlabApiError(response.status, messageOf(payload, response.status));
  return payload as T;
}
