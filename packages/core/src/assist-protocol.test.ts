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
  });

  it("reads an invite from a policy answer", () => {
    expect(
      parseAssistInvite({ session: "s", ticket: "k", agent: "Aybin", expiresAt: 1, more: 2 }),
    ).toEqual({ session: "s", ticket: "k", agent: "Aybin", expiresAt: 1 });
    expect(parseAssistInvite({ session: "s", ticket: "k" })).toBeNull();
  });
});
