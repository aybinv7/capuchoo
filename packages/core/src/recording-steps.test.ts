import { describe, expect, it } from "vite-plus/test";
import { parseRecordedStep } from "./recording-steps.js";

const target = {
  tag: "button",
  role: "button",
  name: "Save",
  text: "Save",
  testId: { attribute: "data-testid", value: "save" },
  id: null,
  css: '[data-testid="save"]',
  unique: { testId: true, id: false, text: true },
  inputType: null,
};

describe("recorded steps", () => {
  it("reads a step a recorder sent", () => {
    expect(parseRecordedStep({ kind: "step", action: "tap", target, x: 10, y: 20 })).toEqual({
      kind: "step",
      action: "tap",
      target,
      x: 10,
      y: 20,
    });
  });

  it("keeps a masked value masked", () => {
    expect(
      parseRecordedStep({ kind: "step", action: "type", target, value: null, masked: true }),
    ).toMatchObject({ value: null, masked: true });
  });

  it("refuses what is not a step, or a step it cannot use", () => {
    expect(parseRecordedStep({ kind: "route", url: "/" })).toBeNull();
    expect(parseRecordedStep({ kind: "step", action: "dance", target })).toBeNull();
    expect(parseRecordedStep({ kind: "step", action: "tap", target: { tag: "a" } })).toBeNull();
    expect(parseRecordedStep(null)).toBeNull();
  });

  it("drops a half-given position and loose flags", () => {
    const step = parseRecordedStep({
      kind: "step",
      action: "tap",
      target: { ...target, unique: { testId: "yes" } },
      x: 4,
    });
    expect(step).not.toHaveProperty("x");
    expect(step?.target.unique).toEqual({ testId: false, id: false, text: false });
  });
});
