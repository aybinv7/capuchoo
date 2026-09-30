import { networkError, toApiError, type ApiError } from "./errors";

export const API_BASE = "/api";

type QueryValue = string | number | boolean | null | undefined;
export type Query = Record<string, QueryValue>;

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
}

let unauthorizedListener: ((error: ApiError) => void) | null = null;

/** Registers the single handler told about a 401, so the session can be dropped in one place. */
export function onUnauthorized(listener: (error: ApiError) => void): void {
  unauthorizedListener = listener;
}

/** `/api` + path + a query string that skips empty values. */
export function buildUrl(path: string, query?: Query): string {
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `${url}?${search}` : url;
}

async function readPayload(response: Response): Promise<unknown> {
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) {
    const text = await response.text().catch(() => "");
    return text || null;
  }
  return response.json().catch(() => null);
}

/**
 * The only function that talks to the server. The session is the httpOnly cookie, sent because the
 * dashboard and the API share an origin; the browser adds `Origin` to writes, which the server's
 * CSRF check requires.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, signal } = options;
  const headers: Record<string, string> = { accept: "application/json" };
  if (body !== undefined) headers["content-type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      credentials: "same-origin",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (cause) {
    if (signal?.aborted) throw cause;
    throw networkError();
  }

  if (response.status === 204) return undefined as T;
  const payload = await readPayload(response);
  if (!response.ok) {
    const error = toApiError(response.status, payload, response.headers.get("retry-after"));
    if (error.status === 401) unauthorizedListener?.(error);
    throw error;
  }
  return payload as T;
}

export const http = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) =>
    request<T>(path, { query, signal }),
  post: <T>(path: string, body: unknown = {}) => request<T>(path, { method: "POST", body }),
  put: <T>(path: string, body: unknown = {}) => request<T>(path, { method: "PUT", body }),
  patch: <T>(path: string, body: unknown = {}) => request<T>(path, { method: "PATCH", body }),
  delete: <T = void>(path: string, query?: Query) => request<T>(path, { method: "DELETE", query }),
};
