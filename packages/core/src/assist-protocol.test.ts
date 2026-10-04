import { describe, expect, it } from "vite-plus/test";
import {
  ASSIST_LIMITS,
  parseAgentMessage,
  parseAssistHello,
  parseAssistInvite,
  parseDeviceMessage,
} from "./assist-protocol.js";

describe("assist protocol", () => {
  it("reads a hello from either side and nothing else", () => {
    expect(parseAssistHello({ t: "hello", session: "s", role: "agent", ticket: "k" })).toEqual({
      t: "hello",
      session: "s",
      role: "agent",
      ticket: "k",
    });
    expect(parseAssistHello({ t: "hello", session: "s", role: "admin", ticket: "k" })).toBeNull();
    expect(parseAssistHello({ t: "tap", x: 1, y: 1 })).toBeNull();
  });

  it("keeps an agent's command to its fields and refuses what it does not know", () => {
    expect(parseAgentMessage({ t: "tap", x: 10, y: 20, extra: "<script>" })).toEqual({
      t: "tap",
      x: 10,
      y: 20,
    });
    expect(parseAgentMessage({ t: "tap", x: "10", y: 20 })).toBeNull();
    expect(parseAgentMessage({ t: "eval", code: "alert(1)" })).toBeNull();
    expect(parseAgentMessage({ t: "key", key: "F12" })).toBeNull();
    expect(parseAgentMessage({ t: "key", key: "Enter" })).toEqual({ t: "key", key: "Enter" });
  });

  it("bounds what an agent can type and scroll", () => {
    expect(
      parseAgentMessage({ t: "type", text: "x".repeat(ASSIST_LIMITS.typedText + 1) }),
    ).toBeNull();
    expect(parseAgentMessage({ t: "scroll", x: 0, y: 0, dx: 0, dy: 99_999 })).toEqual({
      t: "scroll",
      x: 0,
      y: 0,
      dx: 0,
      dy: 5000,
    });
    expect(parseAgentMessage({ t: "pointer", x: Number.NaN, y: 0 })).toBeNull();
  });

  it("keeps a valid anchor on a point and drops a bad one", () => {
    expect(
      parseAgentMessage({ t: "tap", x: 10, y: 20, anchor: { id: 42, fx: 0.25, fy: 1.4 } }),
    ).toEqual({ t: "tap", x: 10, y: 20, anchor: { id: 42, fx: 0.25, fy: 1 } });
    expect(
      parseAgentMessage({ t: "pointer", x: 1, y: 2, anchor: { id: 0, fx: 0.5, fy: 0.5 } }),
    ).toEqual({ t: "pointer", x: 1, y: 2 });
    expect(
      parseAgentMessage({
        t: "scroll",
        x: 1,
        y: 2,
        dx: 0,
        dy: 40,
        anchor: { id: 1.5, fx: 0, fy: 0 },
      }),
    ).toEqual({ t: "scroll", x: 1, y: 2, dx: 0, dy: 40 });
    expect(
      parseAgentMessage({
        t: "scroll",
        x: 1,
        y: 2,
        dx: 0,
        dy: 40,
        anchor: { id: 7, fx: 0, fy: "a" },
      }),
    ).toEqual({ t: "scroll", x: 1, y: 2, dx: 0, dy: 40 });
  });

  it("reads what a device reports", () => {
    expect(parseDeviceMessage({ t: "events", events: [{ type: 2 }] })).toEqual({
      t: "events",
      events: [{ type: 2 }],
    });
    expect(parseDeviceMessage({ t: "control", state: "granted" })).toEqual({
      t: "control",
      state: "granted",
    });
    expect(parseDeviceMessage({ t: "control", state: "owned" })).toBeNull();
    expect(parseDeviceMessage({ t: "end", reason: "user" })).toEqual({ t: "end", reason: "user" });
    expect(parseDeviceMessage({ t: "blocked", x: 3, y: 4 })).toEqual({ t: "blocked", x: 3, y: 4 });
    expect(parseDeviceMessage({ t: "blocked", x: "3", y: 4 })).toBeNull();
  });

  it("reads an invite from a policy answer", () => {
    expect(
      parseAssistInvite({ session: "s", ticket: "k", agent: "Aybin", expiresAt: 1, more: 2 }),
    ).toEqual({ session: "s", ticket: "k", agent: "Aybin", expiresAt: 1 });
    expect(parseAssistInvite({ session: "s", ticket: "k" })).toBeNull();
  });
});
