/**
 * A post-sign-in destination taken from the query string, kept only when it is a path inside the
 * dashboard. Anything else (another origin, `//host`, a backslash trick) falls back.
 */
export function safeRedirect(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || !value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.includes("\\") || /^\/[a-z]+:/i.test(value)) return fallback;
  if (value.startsWith("/login") || value.startsWith("/invite/")) return fallback;
  return value;
}
