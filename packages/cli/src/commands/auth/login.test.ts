import { describe, expect, it } from "vite-plus/test";
import { HttpError } from "../../utils/http.js";
import AuthLogin from "./login.js";

/**
 * There is no `capuchoo auth register`: accounts come from the server's first admin or from an
 * invitation. These messages are what a refused sign-in says instead.
 */
describe("explainSignInFailure", () => {
  it("says where accounts come from when the credentials are refused", () => {
    const message = AuthLogin.explainSignInFailure(
      new HttpError("Invalid email or password", 401, { reason: "unauthorized" }),
    );
    expect(message).toContain("not accepted");
    expect(message).toContain("invitation");
  });

  it("gives the wait when sign-ins are rate limited", () => {
    const message = AuthLogin.explainSignInFailure(
      new HttpError("Too many requests", 429, { reason: "rate_limited", retry_after: 170 }),
    );
    expect(message).toContain("about 3 minutes");
  });

  // A network failure or a 500 must not be dressed up as a credential problem.
  it("passes anything else through untouched", () => {
    expect(AuthLogin.explainSignInFailure(new Error("socket hang up"))).toBe("socket hang up");
    expect(AuthLogin.explainSignInFailure(new HttpError("Internal server error", 500, null))).toBe(
      "Internal server error",
    );
  });

  it("copes with a thrown non-error", () => {
    expect(AuthLogin.explainSignInFailure("boom")).toBe("boom");
  });
});
