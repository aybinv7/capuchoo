import { describe, expect, it } from "vite-plus/test";
import { issueOf, normaliseIssueMessage, parseRecordingIssues } from "./recording-issues.js";

const STACK = (
  hash: string,
  column: number,
) => `TypeError: Cannot read properties of undefined (reading 'lines')
    at Module.Ky (https://localhost/assets/index-${hash}.js:1:${column})
    at async https://localhost/assets/index-${hash}.js:1:900`;

describe("issueOf", () => {
  it("groups the same failure across sessions, devices and builds", () => {
    const first = issueOf(
      "Unhandled rejection TypeError: Cannot read properties of undefined (reading 'lines')",
      STACK("7Zxsr9SK", 40517),
    );
    const rebuilt = issueOf(
      "TypeError: Cannot read properties of undefined (reading 'lines')",
      STACK("Bq9_x-2a", 40611),
    );
    expect(first.fingerprint).toBe(rebuilt.fingerprint);
    expect(first.message).toBe("TypeError: Cannot read properties of undefined (reading 'lines')");
    expect(first.frame).toBe("at Module.Ky (https://localhost/assets/index-7Zxsr9SK.js:1:40517)");
  });

  it("keeps different failures apart", () => {
    const lines = issueOf("TypeError: x is undefined", STACK("7Zxsr9SK", 1));
    const elsewhere = issueOf(
      "TypeError: x is undefined",
      "at f (https://localhost/assets/vendor-AAAAAAAA.js:1:1)",
    );
    const other = issueOf("RangeError: Invalid array length", STACK("7Zxsr9SK", 1));
    expect(new Set([lines.fingerprint, elsewhere.fingerprint, other.fingerprint]).size).toBe(3);
  });

  it("drops the parts of a message that vary between occurrences", () => {
    expect(
      normaliseIssueMessage(
        "Uncaught Error: order 4211 failed for 0190a8d2-7c1e-7b3a-9f00-1234567890ab at https://api.test/orders/4211\nsecond line",
      ),
    ).toBe("Error: order <n> failed for <id> at <url>");
  });
});

describe("parseRecordingIssues", () => {
  it("keeps at most five well-formed issues and clamps the rest", () => {
    const parsed = parseRecordingIssues([
      { fingerprint: "abc12", message: "Error: boom", frame: "at x", count: 3, at: 10 },
      { fingerprint: "BAD!", message: "nope" },
      { fingerprint: "def34", message: "  " },
      ...Array.from({ length: 6 }, (_, index) => ({ fingerprint: `f${index}`, message: "m" })),
    ]);
    expect(parsed[0]).toEqual({
      fingerprint: "abc12",
      message: "Error: boom",
      frame: "at x",
      count: 3,
      at: 10,
    });
    expect(parsed.length).toBeLessThanOrEqual(5);
    expect(parseRecordingIssues("nope")).toEqual([]);
  });
});
