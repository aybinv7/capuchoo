import { describe, expect, it } from "vite-plus/test";
import { CONFIG_KEY_PATTERN, configValueProblem } from "./config-value";

describe("configValueProblem", () => {
  it("checks a value against its declared type", () => {
    expect(configValueProblem("42.5", "number")).toBeNull();
    expect(configValueProblem("", "number")).toBe("Not a number.");
    expect(configValueProblem("yes", "boolean")).toBe("Use true or false.");
    expect(configValueProblem("false", "boolean")).toBeNull();
    expect(configValueProblem('{"a":1}', "json")).toBeNull();
    expect(configValueProblem("{a:1}", "json")).toBe("Not valid JSON.");
    expect(configValueProblem("anything", "string")).toBeNull();
  });

  it("matches the server's key rule", () => {
    expect(CONFIG_KEY_PATTERN.test("feature.checkout-v2")).toBe(true);
    expect(CONFIG_KEY_PATTERN.test("2fast")).toBe(false);
    expect(CONFIG_KEY_PATTERN.test("with space")).toBe(false);
  });
});
