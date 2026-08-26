import { describe, expect, it } from "vite-plus/test";
import AuthLogin from "./login.js";

/**
 * There is no `capuchoo auth register`: confirming an email is a browser
 * round-trip, so a CLI signup could only ever end by telling you to open a
 * browser. These messages are what stands in for it.
 */
describe("explainSignInFailure", () => {
  it("names the unconfirmed email, which is the likeliest confusion", () => {
    const message = AuthLogin.explainSignInFailure(new Error("Email not confirmed"));

    expect(message).toContain("not been confirmed");
    expect(message).toContain("run this again");
  });

  it("says where to sign up, since it cannot be done here", () => {
    const message = AuthLogin.explainSignInFailure(new Error("Invalid login credentials"));

    expect(message).toContain("dashboard");
    expect(message).toContain("needs a browser");
  });

  // A network failure or a 500 must not be dressed up as a credential problem.
  it("passes anything else through untouched", () => {
    expect(AuthLogin.explainSignInFailure(new Error("socket hang up"))).toBe("socket hang up");
  });

  it("copes with a thrown non-error", () => {
    expect(AuthLogin.explainSignInFailure("boom")).toBe("boom");
  });
});
