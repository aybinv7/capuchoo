export const SESSION_PREFIX = "cps_";
export const API_KEY_PREFIX = "cap_";
export const INVITE_PREFIX = "cpi_";
export const WEBHOOK_PREFIX = "cpw_";
export const SESSION_COOKIE = "capuchoo_session";

/** The credential in a request: a Bearer token, an `x-api-key` header, or the session cookie. */
export function readCredential(input: {
  authorization: string | undefined;
  apiKeyHeader: string | undefined;
  cookie: string | undefined;
}): { token: string; from: "header" | "cookie" } | null {
  const bearer = input.authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (bearer) return { token: bearer, from: "header" };
  if (input.apiKeyHeader) return { token: input.apiKeyHeader.trim(), from: "header" };
  if (input.cookie) return { token: input.cookie, from: "cookie" };
  return null;
}
