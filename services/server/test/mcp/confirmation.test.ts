import { describe, expect, it } from "vite-plus/test";
import {
  CONFIRMATION_TTL_MS,
  checkConfirmation,
  issueConfirmation,
} from "../../src/mcp/confirmation";

const SECRET = "test-secret-key-that-is-long-enough-000";
const NOW = new Date("2026-10-04T10:00:00Z");
const subject = {
  userId: "u1",
  keyId: "k1",
  action: "deliver_release",
  args: { channel: "prod", version: "1.9.2", reason: "hotfix" },
};

describe("MCP confirmations", () => {
  it("lets the same caller make the same change before it expires", () => {
    const { token } = issueConfirmation(SECRET, subject, NOW);
    expect(checkConfirmation(SECRET, token, subject, NOW)).toBe("valid");
    expect(
      checkConfirmation(
        SECRET,
        token,
        { ...subject, args: { reason: "hotfix", version: "1.9.2", channel: "prod" } },
        NOW,
      ),
    ).toBe("valid");
  });

  it("refuses another change, another caller, another key, or a forged token", () => {
    const { token } = issueConfirmation(SECRET, subject, NOW);
    expect(
      checkConfirmation(
        SECRET,
        token,
        { ...subject, args: { ...subject.args, version: "1.9.3" } },
        NOW,
      ),
    ).toBe("mismatch");
    expect(checkConfirmation(SECRET, token, { ...subject, userId: "u2" }, NOW)).toBe("mismatch");
    expect(checkConfirmation(SECRET, token, { ...subject, keyId: "k2" }, NOW)).toBe("mismatch");
    expect(checkConfirmation(SECRET, token, { ...subject, action: "rollback_channel" }, NOW)).toBe(
      "mismatch",
    );
    expect(checkConfirmation("another-secret-that-is-long-enough-000", token, subject, NOW)).toBe(
      "mismatch",
    );
    expect(checkConfirmation(SECRET, `${token}x`, subject, NOW)).toBe("mismatch");
    expect(checkConfirmation(SECRET, "garbage", subject, NOW)).toBe("mismatch");
  });

  it("expires", () => {
    const { token } = issueConfirmation(SECRET, subject, NOW);
    const later = new Date(NOW.getTime() + CONFIRMATION_TTL_MS + 1);
    expect(checkConfirmation(SECRET, token, subject, later)).toBe("expired");
  });
});
