import { describe, expect, it } from "vite-plus/test";
import { checkNativeGate } from "./native-gate.js";

const facts = (over: Partial<Parameters<typeof checkNativeGate>[0]> = {}) => ({
  gate: null,
  channelNativeCode: 10,
  channelName: "prod",
  ...over,
});

describe("a bundle with no gate", () => {
  it.each([null, undefined, ""])("%s is ungated and always fine", (gate) => {
    expect(checkNativeGate(facts({ gate }))).toEqual({ ok: true, gate: null });
  });

  it("is fine even on a channel serving no native at all", () => {
    // The common case: an app that has never shipped a binary through Capuchoo
    // still publishes OTA bundles.
    expect(checkNativeGate(facts({ gate: null, channelNativeCode: null })).ok).toBe(true);
  });
});

describe("a gate the channel can satisfy", () => {
  it("passes when the channel's native is newer", () => {
    expect(checkNativeGate(facts({ gate: "8", channelNativeCode: 10 }))).toEqual({
      ok: true,
      gate: 8,
    });
  });

  it("passes when it is exactly the channel's native", () => {
    // The line is "at least this build", so equal satisfies it. Off by one here
    // would refuse the most ordinary publish there is: ship the binary, then
    // ship the bundle that needs it.
    expect(checkNativeGate(facts({ gate: "10", channelNativeCode: 10 })).ok).toBe(true);
  });

  it("accepts the number the database hands back", () => {
    // The column is text in one place and read as a number in another.
    expect(checkNativeGate(facts({ gate: 8, channelNativeCode: 10 })).ok).toBe(true);
  });
});

describe("a gate the channel cannot satisfy", () => {
  /**
   * The silent freeze, which is why this check exists.
   *
   * The device is answered `native-required`, the server looks for a binary at
   * or above the line, finds none, and sends `native_update: null`.
   * `resolveUpdate` reads that as "no update", so the device is not crashed -
   * it simply stops updating, is never told why, and the release still reads as
   * published on the dashboard.
   */
  it("refuses a gate above the channel's native", () => {
    const verdict = checkNativeGate(facts({ gate: "20", channelNativeCode: 10 }));

    expect(verdict.ok).toBe(false);
    expect(verdict).toMatchObject({ reason: "unsatisfiable", gate: 20, available: 10 });
  });

  it("refuses a gate on a channel with no native release", () => {
    const verdict = checkNativeGate(facts({ gate: "1", channelNativeCode: null }));

    expect(verdict).toMatchObject({ reason: "unsatisfiable", available: null });
    if (verdict.ok) throw new Error("expected a refusal");
    expect(verdict.problem).toContain("serves no native release at all");
  });

  it("names the channel and both builds, and says what to do", () => {
    const verdict = checkNativeGate(
      facts({ gate: "20", channelNativeCode: 10, channelName: "prod" }),
    );
    if (verdict.ok) throw new Error("expected a refusal");

    expect(verdict.problem).toContain("prod");
    expect(verdict.problem).toContain("20");
    expect(verdict.problem).toContain("10");
    expect(verdict.problem).toContain("Publish the native build");
  });
});

/**
 * A version name is the value most likely to be typed, and it is the one that
 * turns the gate off: `Number.parseInt("2.4.0")` is 0, and the decision reads 0
 * as ungated. Refused rather than accepted, because a gate that silently does
 * nothing is worse than no gate - someone believes they are protected.
 */
describe("a malformed gate", () => {
  it.each(["2.4.0", "v10", "latest", "10.0", " ", "-3"])("refuses %s", (gate) => {
    const verdict = checkNativeGate(facts({ gate }));

    expect(verdict.ok, gate).toBe(false);
  });

  it("explains that a version name disables the gate rather than setting it", () => {
    const verdict = checkNativeGate(facts({ gate: "2.4.0" }));
    if (verdict.ok) throw new Error("expected a refusal");

    expect(verdict.reason).toBe("malformed");
    expect(verdict.problem).toContain("disables the gate");
  });

  it("refuses a non-integer number as well as a bad string", () => {
    expect(checkNativeGate(facts({ gate: 1.5 })).ok).toBe(false);
  });

  /**
   * Not malformed: 0 is how the decision spells "no gate".
   * `minimumNativeVersion` returns 0 for anything <= 0 and the branch is
   * `minimum > 0`, so treating 0 as a live gate here would make this function
   * disagree with the code it protects - and refuse a publish the server would
   * have served happily.
   */
  it.each([0, "0", -1])("treats %s as no gate, because the decision does", (gate) => {
    expect(checkNativeGate(facts({ gate, channelNativeCode: null }))).toEqual({
      ok: true,
      gate: null,
    });
  });
});
