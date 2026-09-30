import { Capacitor, CapacitorHttp } from "@capacitor/core";

/** The server answered, and not with success. */
export class HttpError extends Error {
  readonly status: number;
  readonly url: string;
  /** The server's own `error` or `message`, when it sent JSON carrying one. */
  readonly serverMessage: string | undefined;

  constructor(url: string, status: number, statusText: string, serverMessage?: string) {
    super(`${url} responded ${status} ${statusText}`.trim());
    this.name = "HttpError";
    this.status = status;
    this.url = url;
    this.serverMessage = serverMessage;
  }
}

/** The request never got an answer: offline, DNS, TLS, reset, or timed out. */
export class NetworkError extends Error {
  readonly timedOut: boolean;

  constructor(url: string, timedOut: boolean, cause: unknown) {
    super(timedOut ? `${url} did not answer in time` : `${url} could not be reached`, { cause });
    this.name = "NetworkError";
    this.timedOut = timedOut;
  }
}

export interface RequestOptions {
  method?: "POST" | "DELETE";
  body?: unknown;
  timeoutMs: number;
  /** Lets the request outlive a WebView reload, for telemetry sent just before one. */
  keepalive?: boolean;
}

function messageOf(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const { error, message } = body as { error?: unknown; message?: unknown };
  const value = error ?? message;
  return typeof value === "string" ? value : undefined;
}

function parse<T>(data: unknown): T {
  if (typeof data === "string") return (data ? JSON.parse(data) : {}) as T;
  return (data ?? {}) as T;
}

/** On a device the request leaves through the native stack: no CORS preflight, no mixed-content block. */
function useNativeTransport(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("CapacitorHttp");
  } catch {
    return false;
  }
}

async function nativeRequest<T>(url: string, options: RequestOptions): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      reject(new NetworkError(url, true, undefined));
    }, options.timeoutMs);
  });

  try {
    const response = await Promise.race([
      CapacitorHttp.request({
        url,
        method: options.method ?? "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        ...(options.body === undefined ? {} : { data: options.body }),
        connectTimeout: options.timeoutMs,
        readTimeout: options.timeoutMs,
        responseType: "json",
      }),
      deadline,
    ]).catch((error: unknown) => {
      if (error instanceof NetworkError) throw error;
      throw new NetworkError(url, timedOut, error);
    });

    if (response.status < 200 || response.status >= 300) {
      throw new HttpError(url, response.status, "", messageOf(parse<unknown>(response.data)));
    }
    return parse<T>(response.data);
  } finally {
    clearTimeout(timer);
  }
}

async function webRequest<T>(url: string, options: RequestOptions): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    let response: Response;
    let text: string;
    try {
      response = await fetch(url, {
        method: options.method ?? "POST",
        headers: { "Content-Type": "application/json" },
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
        ...(options.keepalive ? { keepalive: true } : {}),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => undefined);
        throw new HttpError(url, response.status, response.statusText, messageOf(body));
      }

      text = await response.text();
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new NetworkError(url, controller.signal.aborted, error);
    }

    return (text ? JSON.parse(text) : {}) as T;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Sends JSON and parses a JSON answer.
 *
 * @throws {HttpError} on a non-2xx status.
 * @throws {NetworkError} when no answer arrived within `timeoutMs`.
 */
export function requestJson<T>(url: string, options: RequestOptions): Promise<T> {
  return useNativeTransport() ? nativeRequest<T>(url, options) : webRequest<T>(url, options);
}
