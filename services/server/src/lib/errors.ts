/** An error whose status and message are safe to send to the caller. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly reason?: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const badRequest = (
  message: string,
  reason = "bad_request",
  details?: Record<string, unknown>,
) => new HttpError(400, message, reason, details);
export const unauthorized = (message = "Authentication required") =>
  new HttpError(401, message, "unauthorized");
export const forbidden = (message: string, reason = "forbidden") =>
  new HttpError(403, message, reason);
export const notFound = (noun: string) => new HttpError(404, `${noun} not found`, "not_found");
export const conflict = (message: string, reason = "conflict", details?: Record<string, unknown>) =>
  new HttpError(409, message, reason, details);
export const tooLarge = (message: string) => new HttpError(413, message, "too_large");
export const tooManyRequests = (retryAfterSeconds: number) =>
  new HttpError(429, "Too many requests", "rate_limited", { retry_after: retryAfterSeconds });

function pgCode(error: unknown): unknown {
  return typeof error === "object" && error !== null
    ? (error as { code?: unknown }).code
    : undefined;
}

/** PostgreSQL unique violation. */
export const isUniqueViolation = (error: unknown): boolean => pgCode(error) === "23505";

/** PostgreSQL foreign-key violation: a referenced row is still in use. */
export const isForeignKeyViolation = (error: unknown): boolean => pgCode(error) === "23503";

/** PostgreSQL check violation. */
export const isCheckViolation = (error: unknown): boolean => pgCode(error) === "23514";
