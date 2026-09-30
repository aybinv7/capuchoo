/** An API failure with the server's `{ error, reason, ...details }` body, or a synthesised one. */
export class ApiError extends Error {
  readonly status: number;
  readonly reason: string;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    status: number,
    message: string,
    reason: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.reason = reason;
    this.details = details;
  }

  /** Seconds the server asked the caller to wait, when it rate-limited the request. */
  get retryAfter(): number | null {
    const value = Number(this.details.retry_after);
    return Number.isFinite(value) && value > 0 ? value : null;
  }
}

const FALLBACK_REASON: Record<number, string> = {
  400: "bad_request",
  401: "unauthorized",
  403: "forbidden",
  404: "not_found",
  409: "conflict",
  410: "gone",
  413: "too_large",
  429: "rate_limited",
};

const FALLBACK_MESSAGE: Record<string, string> = {
  bad_request: "The request was not accepted.",
  unauthorized: "Your session has ended. Sign in again.",
  forbidden: "You are not allowed to do that.",
  not_found: "It no longer exists, or you cannot see it.",
  conflict: "That conflicts with the current state. Refresh and retry.",
  gone: "It has expired.",
  too_large: "The payload is too large.",
  rate_limited: "Too many requests.",
  server_error: "The server failed to handle the request.",
  error: "The request failed.",
};

function fallbackReason(status: number): string {
  if (status >= 500) return "server_error";
  return FALLBACK_REASON[status] ?? "error";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Maps an HTTP status and body to an `ApiError`; total over any body the server or a proxy sends. */
export function toApiError(
  status: number,
  payload: unknown,
  retryAfterHeader?: string | null,
): ApiError {
  const fallback = fallbackReason(status);
  if (!isRecord(payload)) {
    const details: Record<string, unknown> = {};
    if (retryAfterHeader && Number(retryAfterHeader) > 0)
      details.retry_after = Number(retryAfterHeader);
    return new ApiError(
      status,
      FALLBACK_MESSAGE[fallback] ?? "The request failed.",
      fallback,
      details,
    );
  }
  const { error, reason, ...details } = payload;
  if (details.retry_after === undefined && retryAfterHeader && Number(retryAfterHeader) > 0)
    details.retry_after = Number(retryAfterHeader);
  const code = typeof reason === "string" && reason ? reason : fallback;
  const message =
    typeof error === "string" && error.trim()
      ? error
      : (FALLBACK_MESSAGE[code] ?? FALLBACK_MESSAGE[fallback] ?? "The request failed.");
  return new ApiError(status, message, code, details);
}

/** A request that never reached the server. */
export function networkError(): ApiError {
  return new ApiError(
    0,
    "The server could not be reached. Check the connection and retry.",
    "network",
  );
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

const TITLES: Record<string, string> = {
  network: "Server unreachable",
  unauthorized: "Signed out",
  forbidden: "Not allowed",
  csrf: "Request refused",
  not_found: "Not found",
  rate_limited: "Slow down",
  environment_locked: "Environment is fixed",
  still_served: "Still being served",
  has_clients: "Channel has clients",
  last_owner: "Last owner",
  channel_exists: "Name taken",
  stale: "Channel changed",
  server_error: "Server error",
  "other-app": "Delivery refused",
  unflavoured: "Delivery refused",
  "flavour-mismatch": "Delivery refused",
  "platform-disabled": "Delivery refused",
  "not-on-base": "Delivery refused",
  "native-gate": "Delivery refused",
  "strands-bundle": "Delivery refused",
  "downgrade-needs-rollback": "Delivery refused",
  "rollback-not-lower": "Rollback refused",
};

/** A short heading for an error, keyed by the server's reason code. */
export function errorTitle(error: unknown): string {
  if (!isApiError(error)) return "Something went wrong";
  return TITLES[error.reason] ?? (error.status === 409 ? "Conflict" : "Request failed");
}

/** The sentence to show a person. Server messages are written for people, so they are kept. */
export function errorMessage(error: unknown): string {
  if (!isApiError(error)) return error instanceof Error ? error.message : "Unexpected error.";
  if (error.reason === "rate_limited") {
    const wait = error.retryAfter;
    return wait
      ? `Too many attempts. Try again in ${Math.ceil(wait)} s.`
      : "Too many attempts. Try again shortly.";
  }
  if (error.reason === "csrf")
    return "The server refused a cross-site write. Open the dashboard from the server's own address.";
  if (error.reason === "server_error" && error.message === "Internal server error")
    return FALLBACK_MESSAGE.server_error ?? error.message;
  return error.message;
}
