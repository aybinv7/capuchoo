import { Capacitor, CapacitorHttp } from "@capacitor/core";

/** A refusal the server answered with, or a request that never got an answer (`status` 0). */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly reason: string | null = null,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get offline(): boolean {
    return this.status === 0;
  }
}

export interface Credentials {
  endpoint: string;
  token: string | null;
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

const TIMEOUT_MS = 20_000;

function messageOf(body: unknown, status: number): { message: string; reason: string | null } {
  if (body && typeof body === "object") {
    const record = body as { error?: unknown; message?: unknown; reason?: unknown };
    const text = typeof record.error === "string" ? record.error : record.message;
    if (typeof text === "string" && text)
      return { message: text, reason: typeof record.reason === "string" ? record.reason : null };
  }
  return { message: `The server answered ${status}`, reason: null };
}

/**
 * The management API sends no CORS headers, so a WebView `fetch` to it is refused. On a device the
 * request goes through Capacitor's native HTTP, which is not subject to CORS; in a browser it goes
 * through the dev server's `/api` proxy. The credential is a Bearer token in both: a header is not
 * ambient like the dashboard's cookie, so the server skips its CSRF check for it.
 */
export async function request<T>(
  credentials: Credentials,
  method: Method,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (credentials.token) headers.Authorization = `Bearer ${credentials.token}`;

  const native = Capacitor.isNativePlatform();
  const url = native ? `${credentials.endpoint.replace(/\/+$/, "")}${path}` : path;

  let status: number;
  let data: unknown;
  try {
    if (native) {
      const response = await CapacitorHttp.request({
        url,
        method,
        headers,
        ...(body !== undefined ? { data: body } : {}),
        connectTimeout: TIMEOUT_MS,
        readTimeout: TIMEOUT_MS,
      });
      status = response.status;
      data = response.data;
    } else {
      const response = await fetch(url, {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      status = response.status;
      const text = await response.text();
      data = text ? JSON.parse(text) : null;
    }
  } catch (error) {
    throw new ApiError(
      `Could not reach ${credentials.endpoint}: ${error instanceof Error ? error.message : String(error)}`,
      0,
    );
  }

  if (typeof data === "string" && data.startsWith("{")) {
    try {
      data = JSON.parse(data);
    } catch {
      // Left as text: an HTML error page from a proxy is still worth showing as-is.
    }
  }

  if (status < 200 || status >= 300) {
    const { message, reason } = messageOf(data, status);
    throw new ApiError(message, status, reason);
  }
  return data as T;
}
