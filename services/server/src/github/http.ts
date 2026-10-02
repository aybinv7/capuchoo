import { HttpError } from "../lib/errors";

export interface GithubTransport {
  fetch: typeof globalThis.fetch;
  apiUrl: string;
  timeoutMs: number;
}

export interface GithubRequest {
  token?: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  accept?: string;
  /** Statuses answered as `null` instead of thrown, such as 404 for "not there yet". */
  allow?: number[];
}

const PASSED_THROUGH = new Set([403, 404, 409, 422]);

/** A GitHub API refusal, carried to the caller with GitHub's own message. */
export class GithubApiError extends HttpError {
  constructor(
    readonly upstreamStatus: number,
    message: string,
  ) {
    super(
      PASSED_THROUGH.has(upstreamStatus) ? upstreamStatus : 502,
      `GitHub: ${message}`,
      "github_error",
      {
        upstream_status: upstreamStatus,
      },
    );
  }
}

const USER_AGENT = "capuchoo-server";
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;

function url(base: string, path: string, query?: GithubRequest["query"]): string {
  const root = new URL(base);
  const target = new URL(path.startsWith("http") ? path : `${base.replace(/\/+$/, "")}${path}`);
  if (target.origin !== root.origin)
    throw new GithubApiError(502, "refused a link to another host");
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== "") target.searchParams.set(key, String(value));
  }
  return target.toString();
}

async function readBody(response: Response): Promise<unknown> {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_RESPONSE_BYTES) throw new GithubApiError(502, "response too large");
  const text = await response.text();
  if (text.length > MAX_RESPONSE_BYTES) throw new GithubApiError(502, "response too large");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function messageOf(payload: unknown, status: number): string {
  if (payload && typeof payload === "object") {
    const record = payload as { message?: unknown; errors?: unknown };
    const detail = Array.isArray(record.errors)
      ? record.errors
          .map((error) =>
            error && typeof error === "object"
              ? String((error as { message?: unknown }).message ?? "")
              : String(error),
          )
          .filter(Boolean)
          .join("; ")
      : "";
    if (typeof record.message === "string")
      return detail ? `${record.message} (${detail})` : record.message;
  }
  return `HTTP ${status}`;
}

export interface GithubResponse<T> {
  data: T;
  headers: Headers;
}

/** One GitHub REST call with a timeout, bounded body and GitHub's error message preserved. */
export async function githubCall<T>(
  transport: GithubTransport,
  method: string,
  path: string,
  options: GithubRequest = {},
): Promise<GithubResponse<T | null>> {
  const headers: Record<string, string> = {
    accept: options.accept ?? "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": USER_AGENT,
  };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers["content-type"] = "application/json";

  let response: Response;
  try {
    response = await transport.fetch(url(transport.apiUrl, path, options.query), {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(transport.timeoutMs),
      redirect: "follow",
    });
  } catch (error) {
    const timedOut =
      error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    throw new GithubApiError(502, timedOut ? "timed out" : "unreachable");
  }

  if (options.allow?.includes(response.status)) {
    await response.body?.cancel().catch(() => undefined);
    return { data: null, headers: response.headers };
  }
  const payload = response.status === 204 ? null : await readBody(response);
  if (!response.ok) {
    const limited =
      response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0";
    throw new GithubApiError(
      response.status,
      limited ? "rate limit exhausted" : messageOf(payload, response.status),
    );
  }
  return { data: payload as T, headers: response.headers };
}

/** The `next` page from a Link header, or null. */
export function nextPage(headers: Headers): string | null {
  const link = headers.get("link");
  if (!link) return null;
  for (const part of link.split(",")) {
    const match = /<([^>]+)>;\s*rel="next"/.exec(part);
    if (match?.[1]) return match[1];
  }
  return null;
}
