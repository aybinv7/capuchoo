import { HttpError, NetworkError } from "./http.js";

const TRANSIENT_STATUS = new Set([408, 425, 429]);

/**
 * Whether a failure says nothing about the request itself - no answer, a
 * timeout, an overloaded or restarting server, or a captive portal answering
 * HTML - and is worth retrying rather than showing to the user.
 */
export function isTransientError(error: unknown): boolean {
  if (error instanceof NetworkError) return true;
  if (error instanceof HttpError) return error.status >= 500 || TRANSIENT_STATUS.has(error.status);
  return error instanceof SyntaxError;
}

/** HTTP status of a failed download, from the file-transfer plugin's error or an HttpError. */
export function downloadStatus(error: unknown): number | undefined {
  if (error instanceof HttpError) return error.status;
  const candidate = error as { data?: { httpStatus?: unknown }; httpStatus?: unknown } | null;
  const status = candidate?.data?.httpStatus ?? candidate?.httpStatus;
  return typeof status === "number" ? status : undefined;
}

const EXPIRED_LINK_STATUS = new Set([401, 403, 410]);

/** A signed download link that has expired or been revoked; a fresh check issues a new one. */
export function isExpiredLinkError(error: unknown): boolean {
  const status = downloadStatus(error);
  return status !== undefined && EXPIRED_LINK_STATUS.has(status);
}
