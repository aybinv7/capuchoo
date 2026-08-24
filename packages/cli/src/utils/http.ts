import fs from "node:fs";
import { openAsBlob } from "node:fs";
import path from "node:path";

/**
 * HTTP for the CLI.
 *
 * Node 22 has `fetch`, `FormData` and `openAsBlob`, which between them cover
 * everything the CLI was using `axios` and `form-data` for. `openAsBlob` in
 * particular reads lazily, so a 60 MB APK is streamed rather than buffered -
 * the previous `fs.createReadStream` plus `maxBodyLength: Infinity` combination
 * worked, but only because the limit was disabled.
 */

export class HttpError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.body = body;
  }
}

export interface HttpOptions {
  endpoint: string;
  apiKey: string;
  timeoutMs?: number;
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/** Extracts a useful message from whatever shape the server returned. */
function messageFrom(body: unknown, fallback: string): string {
  if (typeof body === "string" && body.length > 0) return body;
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;

    // `details` carries the reason on this API's 500s, where `error` is a
    // category: {"error":"Upload failed","details":"duplicate key ..."}. Reading
    // only `error` turned every upload problem into the word "Upload failed",
    // which says nothing a caller can act on. Both are reported when both exist.
    const category = ["message", "error"]
      .map((key) => record[key])
      .find((value): value is string => typeof value === "string" && value.length > 0);
    const reason = ["details", "detail"]
      .map((key) => record[key])
      .find((value): value is string => typeof value === "string" && value.length > 0);

    if (category && reason) return `${category}: ${reason}`;
    if (category) return category;
    if (reason) return reason;
  }
  return fallback;
}

async function request<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  options: HttpOptions & { body?: unknown },
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      // The key is omitted entirely rather than set to undefined: a GET with a
      // body is invalid, and some runtimes reject it outright.
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      signal: controller.signal,
    });

    const body = await readBody(response);

    if (!response.ok) {
      throw new HttpError(
        messageFrom(body, `${method} ${url} responded ${response.status}`),
        response.status,
        body,
      );
    }

    return body as T;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`${url} did not respond within the timeout`);
    }
    // A DNS or TLS failure surfaces as an opaque "fetch failed"; say which host.
    if (error instanceof TypeError) {
      throw new Error(`Could not reach ${new URL(url).host}: ${error.message}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function get<T>(pathname: string, options: HttpOptions): Promise<T> {
  return request<T>("GET", `${options.endpoint}${pathname}`, options);
}

export function post<T>(pathname: string, body: unknown, options: HttpOptions): Promise<T> {
  return request<T>("POST", `${options.endpoint}${pathname}`, { ...options, body });
}

/** A 204 is the success case here, so the caller gets nothing back. */
export async function del(pathname: string, options: HttpOptions): Promise<void> {
  await request<unknown>("DELETE", `${options.endpoint}${pathname}`, options);
}

export interface UploadResult {
  status: number;
  body: unknown;
}

/**
 * Uploads a build artefact as multipart form data.
 *
 * The upload timeout is separate and generous: a release APK on a slow
 * connection legitimately takes minutes, and the 30 second default used for API
 * calls would abort it.
 */
export async function uploadArtifact(
  pathname: string,
  filePath: string,
  fields: Record<string, string>,
  options: HttpOptions & { fileField?: string; timeoutMs?: number },
): Promise<UploadResult> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Nothing to upload: ${filePath} does not exist`);
  }

  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value);
  }

  const blob = await openAsBlob(filePath);
  form.append(options.fileField ?? "bundle", blob, path.basename(filePath));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 15 * 60 * 1000);

  try {
    const response = await fetch(`${options.endpoint}${pathname}`, {
      method: "POST",
      // Content-Type is intentionally omitted: fetch sets it along with the
      // multipart boundary, and providing it by hand breaks the boundary.
      headers: { Authorization: `Bearer ${options.apiKey}` },
      body: form,
      signal: controller.signal,
    });

    const body = await readBody(response);

    if (!response.ok) {
      throw new HttpError(
        messageFrom(body, `Upload rejected with ${response.status}`),
        response.status,
        body,
      );
    }

    return { status: response.status, body };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("The upload timed out");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
