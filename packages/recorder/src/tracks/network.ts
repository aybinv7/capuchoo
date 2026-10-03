import type { Track, TrackContext } from "../recorder/types.js";

export interface NetworkOptions {
  /** Requests to these URLs get a W3C `traceparent` header. Only enable for servers that accept it. */
  propagateTrace?: (url: URL) => boolean;
  /** Header names whose values are replaced. Authorization and cookies always are. */
  redactHeaders?: string[];
  /** URLs never recorded. The recorder's own endpoint never is. */
  ignore?: (url: URL) => boolean;
}

export interface NetworkSettings {
  bodies: boolean;
  maxBodyBytes: number;
  /** Requests to this prefix are the recorder's own and never recorded. */
  selfPrefix: string;
}

export interface NetworkEntry {
  id: string;
  transport: "fetch" | "xhr";
  method: string;
  url: string;
  status: number | null;
  startedAt: number;
  duration: number;
  error: string | null;
  traceId: string | null;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  requestBody: string | null;
  responseBody: string | null;
  responseSize: number | null;
}

const ALWAYS_REDACTED = [
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "proxy-authorization",
];
const TEXTUAL = /^(text\/|application\/(json|xml|x-www-form-urlencoded|graphql|[\w.+-]*\+json))/i;

let counter = 0;
const nextId = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;

function hex(bytes: number): string {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => value.toString(16).padStart(2, "0")).join("");
}

function headersOf(
  source: Headers | Record<string, string> | [string, string][] | undefined,
  redact: Set<string>,
) {
  const result: Record<string, string> = {};
  if (!source) return result;
  const entries =
    source instanceof Headers
      ? [...source.entries()]
      : Array.isArray(source)
        ? source
        : Object.entries(source);
  for (const [name, value] of entries) {
    const key = name.toLowerCase();
    result[key] = redact.has(key) ? "[redacted]" : String(value).slice(0, 500);
  }
  return result;
}

function bodyText(body: unknown, max: number): string | null {
  if (typeof body === "string") return body.length > max ? `${body.slice(0, max)}…` : body;
  if (body instanceof URLSearchParams) return bodyText(body.toString(), max);
  return null;
}

function parseHeaderBlock(block: string, redact: Set<string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of block.trim().split(/[\r\n]+/)) {
    const index = line.indexOf(":");
    if (index <= 0) continue;
    const key = line.slice(0, index).trim().toLowerCase();
    result[key] = redact.has(key)
      ? "[redacted]"
      : line
          .slice(index + 1)
          .trim()
          .slice(0, 500);
  }
  return result;
}

/**
 * Every fetch and XMLHttpRequest, one event when it settles. Bodies are read only when the policy
 * asks, only when textual, and only up to the policy's size, from a clone the app never sees.
 */
export function createNetworkTrack(
  options: NetworkOptions,
  settings: () => NetworkSettings,
): Track {
  const redact = new Set([
    ...ALWAYS_REDACTED,
    ...(options.redactHeaders ?? []).map((name) => name.toLowerCase()),
  ]);
  let restore: (() => void) | null = null;

  function skip(url: URL): boolean {
    return url.href.startsWith(settings().selfPrefix) || (options.ignore?.(url) ?? false);
  }

  function resolve(raw: string): URL | null {
    try {
      return new URL(raw, location.href);
    } catch {
      return null;
    }
  }

  function patchFetch(ctx: TrackContext): () => void {
    const original = window.fetch;
    window.fetch = async function recordedFetch(input: RequestInfo | URL, init?: RequestInit) {
      const raw = input instanceof Request ? input.url : String(input);
      const url = resolve(raw);
      if (!url || skip(url)) return original.call(window, input, init);

      const { bodies, maxBodyBytes } = settings();
      let traceId: string | null = null;
      let nextInit = init;
      if (options.propagateTrace?.(url)) {
        traceId = hex(16);
        const headers = new Headers(
          init?.headers ?? (input instanceof Request ? input.headers : undefined),
        );
        headers.set("traceparent", `00-${traceId}-${hex(8)}-01`);
        nextInit = { ...init, headers };
      }
      const method = (
        nextInit?.method ?? (input instanceof Request ? input.method : "GET")
      ).toUpperCase();
      const startedAt = Date.now();
      const began = performance.now();
      const entry: NetworkEntry = {
        id: nextId(),
        transport: "fetch",
        method,
        url: url.href,
        status: null,
        startedAt,
        duration: 0,
        error: null,
        traceId,
        requestHeaders: headersOf(
          (nextInit?.headers as Headers | Record<string, string> | undefined) ??
            (input instanceof Request ? input.headers : undefined),
          redact,
        ),
        responseHeaders: {},
        requestBody: bodies ? bodyText(nextInit?.body, maxBodyBytes) : null,
        responseBody: null,
        responseSize: null,
      };

      try {
        const response = await original.call(window, input, nextInit);
        entry.status = response.status;
        entry.duration = Math.round(performance.now() - began);
        entry.responseHeaders = headersOf(response.headers, redact);
        const length = Number(response.headers.get("content-length") ?? Number.NaN);
        entry.responseSize = Number.isFinite(length) ? length : null;
        const type = response.headers.get("content-type") ?? "";
        if (bodies && TEXTUAL.test(type) && !(length > maxBodyBytes)) {
          response
            .clone()
            .text()
            .then((text) => {
              entry.responseBody =
                text.length > maxBodyBytes ? `${text.slice(0, maxBodyBytes)}…` : text;
              ctx.push("network", entry, startedAt);
            })
            .catch(() => ctx.push("network", entry, startedAt));
        } else ctx.push("network", entry, startedAt);
        return response;
      } catch (error) {
        entry.duration = Math.round(performance.now() - began);
        entry.error = error instanceof Error ? error.message : String(error);
        ctx.push("network", entry, startedAt);
        throw error;
      }
    } as typeof fetch;
    return () => {
      window.fetch = original;
    };
  }

  function patchXhr(ctx: TrackContext): () => void {
    const proto = XMLHttpRequest.prototype;
    const open = proto.open;
    const send = proto.send;
    const setHeader = proto.setRequestHeader;
    const state = new WeakMap<XMLHttpRequest, NetworkEntry & { skip: boolean; began: number }>();

    proto.open = function recordedOpen(
      this: XMLHttpRequest,
      method: string,
      raw: string | URL,
      ...rest: unknown[]
    ) {
      const url = resolve(String(raw));
      state.set(this, {
        id: nextId(),
        transport: "xhr",
        method: method.toUpperCase(),
        url: url?.href ?? String(raw),
        status: null,
        startedAt: 0,
        duration: 0,
        error: null,
        traceId: null,
        requestHeaders: {},
        responseHeaders: {},
        requestBody: null,
        responseBody: null,
        responseSize: null,
        skip: !url || skip(url),
        began: 0,
      });
      return (open as (...args: unknown[]) => void).call(this, method, raw, ...rest);
    } as typeof proto.open;

    proto.setRequestHeader = function recordedHeader(
      this: XMLHttpRequest,
      name: string,
      value: string,
    ) {
      const entry = state.get(this);
      if (entry && !entry.skip) {
        const key = name.toLowerCase();
        entry.requestHeaders[key] = redact.has(key) ? "[redacted]" : value.slice(0, 500);
      }
      return setHeader.call(this, name, value);
    };

    proto.send = function recordedSend(
      this: XMLHttpRequest,
      body?: Document | XMLHttpRequestBodyInit | null,
    ) {
      const entry = state.get(this);
      if (entry && !entry.skip) {
        const { bodies, maxBodyBytes } = settings();
        entry.startedAt = Date.now();
        entry.began = performance.now();
        entry.requestBody = bodies ? bodyText(body, maxBodyBytes) : null;
        this.addEventListener("loadend", () => {
          entry.duration = Math.round(performance.now() - entry.began);
          entry.status = this.status || null;
          if (this.status === 0) entry.error = "network error";
          entry.responseHeaders = parseHeaderBlock(this.getAllResponseHeaders(), redact);
          const type = this.getResponseHeader("content-type") ?? "";
          if (
            bodies &&
            TEXTUAL.test(type) &&
            (this.responseType === "" || this.responseType === "text")
          ) {
            entry.responseBody = bodyText(this.responseText, maxBodyBytes);
          }
          const { skip: _skip, began: _began, ...event } = entry;
          ctx.push("network", event, entry.startedAt);
        });
      }
      return send.call(this, body);
    };

    return () => {
      proto.open = open;
      proto.send = send;
      proto.setRequestHeader = setHeader;
    };
  }

  return {
    name: "network",
    start(ctx) {
      if (restore) return;
      const undoFetch = typeof window.fetch === "function" ? patchFetch(ctx) : () => undefined;
      const undoXhr = typeof XMLHttpRequest === "function" ? patchXhr(ctx) : () => undefined;
      restore = () => {
        undoFetch();
        undoXhr();
      };
    },
    stop() {
      restore?.();
      restore = null;
    },
  };
}
