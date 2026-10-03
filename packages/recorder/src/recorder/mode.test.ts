import { describe, expect, it } from "vite-plus/test";
import { effectiveMode, mergeEscalation, sessionStart, transition } from "./mode.js";

const policy = { mode: "buffer" as const, ceiling: "session" as const };

describe("effectiveMode", () => {
  it("is off without a policy, the baseline without an escalation", () => {
    expect(effectiveMode(null, null, 0)).toBe("off");
    expect(effectiveMode(policy, null, 0)).toBe("buffer");
  });

  it("raises to the escalation until it expires, never past the ceiling", () => {
    const escalation = { mode: "live" as const, until: 100, start: "shake" as const };
    expect(effectiveMode(policy, escalation, 50)).toBe("session");
    expect(effectiveMode(policy, escalation, 100)).toBe("buffer");
    expect(sessionStart(policy, escalation, 50)).toBe("shake");
    expect(sessionStart(policy, escalation, 150)).toBe("policy");
  });
});

describe("mergeEscalation", () => {
  it("keeps the higher mode and the later deadline", () => {
    const merged = mergeEscalation(
      { mode: "live", until: 100, start: "app" },
      { mode: "session", until: 300, start: "error" },
      0,
    );
    expect(merged).toEqual({ mode: "live", until: 300, start: "app" });
  });

  it("replaces an expired escalation", () => {
    const next = { mode: "session" as const, until: 500, start: "shake" as const };
    expect(mergeEscalation({ mode: "live", until: 10, start: "app" }, next, 20)).toEqual(next);
  });
});

describe("transition", () => {
  it("keeps the buffer when promoting and starts a fresh session when demoting", () => {
    expect(transition("off", "buffer").kind).toBe("begin");
    expect(transition("buffer", "session").kind).toBe("promote");
    expect(transition("session", "buffer").kind).toBe("rotate");
    expect(transition("session", "live").kind).toBe("retune");
    expect(transition("live", "off").kind).toBe("end");
    expect(transition("buffer", "buffer").kind).toBe("none");
  });
});
