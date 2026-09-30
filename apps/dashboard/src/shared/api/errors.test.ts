import { describe, expect, it } from "vite-plus/test";
import { ApiError, errorMessage, errorTitle, isApiError, networkError, toApiError } from "./errors";

describe("toApiError", () => {
  it("keeps the server's message, reason and details", () => {
    const error = toApiError(409, {
      error: 'Bundle 1.0.0 is older than what "prod" serves.',
      reason: "downgrade-needs-rollback",
      channel: "prod",
    });
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(409);
    expect(error.reason).toBe("downgrade-needs-rollback");
    expect(error.message).toContain("older than");
    expect(error.details).toEqual({ channel: "prod" });
  });

  it("falls back to a reason per status when the body has none", () => {
    expect(toApiError(404, { error: "Channel not found" }).reason).toBe("not_found");
    expect(toApiError(403, null).reason).toBe("forbidden");
    expect(toApiError(502, "<html>Bad gateway</html>").reason).toBe("server_error");
    expect(toApiError(418, undefined).reason).toBe("error");
  });

  it("writes a readable message when the body is not the server's JSON", () => {
    const error = toApiError(503, "<html>upstream down</html>");
    expect(error.message).toBe("The server failed to handle the request.");
  });

  it("reads retry_after from the body, then from the Retry-After header", () => {
    expect(
      toApiError(429, { error: "Too many requests", reason: "rate_limited", retry_after: 42 })
        .retryAfter,
    ).toBe(42);
    expect(toApiError(429, null, "7").retryAfter).toBe(7);
    expect(toApiError(429, null, "soon").retryAfter).toBeNull();
  });

  it("ignores an empty error string", () => {
    expect(toApiError(400, { error: "  ", reason: "weak_password" }).message).toBe(
      "The request was not accepted.",
    );
  });
});

describe("error presentation", () => {
  it("titles delivery refusals by their canPoint reason", () => {
    expect(errorTitle(toApiError(409, { error: "x", reason: "not-on-base" }))).toBe(
      "Delivery refused",
    );
    expect(errorTitle(toApiError(409, { error: "x", reason: "rollback-not-lower" }))).toBe(
      "Rollback refused",
    );
    expect(errorTitle(toApiError(409, { error: "x", reason: "environment_locked" }))).toBe(
      "Environment is fixed",
    );
    expect(errorTitle(toApiError(409, { error: "x", reason: "something_new" }))).toBe("Conflict");
  });

  it("explains rate limits and CSRF refusals instead of echoing them", () => {
    expect(
      errorMessage(
        toApiError(429, { error: "Too many requests", reason: "rate_limited", retry_after: 3.2 }),
      ),
    ).toBe("Too many attempts. Try again in 4 s.");
    expect(
      errorMessage(toApiError(403, { error: "Cross-site request refused", reason: "csrf" })),
    ).toContain("own address");
  });

  it("describes network failures and foreign errors", () => {
    const offline = networkError();
    expect(isApiError(offline)).toBe(true);
    expect(offline.status).toBe(0);
    expect(errorTitle(offline)).toBe("Server unreachable");
    expect(errorTitle(new Error("boom"))).toBe("Something went wrong");
    expect(errorMessage(new Error("boom"))).toBe("boom");
    expect(errorMessage("nope")).toBe("Unexpected error.");
  });
});
