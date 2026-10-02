import type { AppContext } from "./context";
import { badRequest, tooLarge } from "../lib/errors";

/** The body as text, with a hard size limit; for signatures computed over the exact bytes. */
export async function readText(c: AppContext, maxBytes = 256 * 1024): Promise<string> {
  const declared = Number(c.req.header("content-length") ?? 0);
  if (declared > maxBytes)
    throw tooLarge(`The request body exceeds ${Math.round(maxBytes / 1024)} KiB`);
  const text = await c.req.text();
  if (text.length > maxBytes)
    throw tooLarge(`The request body exceeds ${Math.round(maxBytes / 1024)} KiB`);
  return text;
}

/** Parses JSON text; an empty body is `{}`. */
export function parseJson<T>(text: string): T {
  if (!text.trim()) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw badRequest("The request body is not valid JSON", "invalid_json");
  }
}

/** Parses a JSON body with a hard size limit; an empty body is `{}`. */
export async function readJson<T = Record<string, unknown>>(
  c: AppContext,
  maxBytes = 256 * 1024,
): Promise<T> {
  return parseJson<T>(await readText(c, maxBytes));
}

/** A bounded integer query parameter. */
export function queryInt(
  c: AppContext,
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = c.req.query(name);
  const value = raw === undefined ? fallback : Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export function requireString(value: unknown, name: string, max = 255): string {
  if (typeof value !== "string" || !value.trim()) throw badRequest(`${name} is required`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw badRequest(`${name} is too long`);
  return trimmed;
}

export function optionalString(value: unknown, max = 2000): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw badRequest("Expected a string");
  return value.trim().slice(0, max) || null;
}

/** The public base URL of this server, for links handed to devices. */
export function baseUrl(c: AppContext): string {
  const { PUBLIC_URL, TRUST_PROXY } = c.get("deps").config;
  if (PUBLIC_URL) return PUBLIC_URL.replace(/\/+$/, "");
  const url = new URL(c.req.url);
  if (TRUST_PROXY) {
    const proto = c.req.header("x-forwarded-proto")?.split(",")[0]?.trim();
    const host = c.req.header("x-forwarded-host")?.split(",")[0]?.trim();
    if (proto) url.protocol = `${proto}:`;
    if (host) url.host = host;
  }
  return url.origin;
}
