import { describe, expect, it } from "vite-plus/test";
import { fitWithinRows } from "./wrap-fit";

describe("fitWithinRows", () => {
  it("keeps everything that fits", () => {
    expect(fitWithinRows([], 2)).toBe(0);
    expect(fitWithinRows([0, 0, 0], 2)).toBe(3);
    expect(fitWithinRows([0, 0, 28, 28], 2)).toBe(4);
  });

  it("cuts at the third row and leaves room for the overflow item", () => {
    expect(fitWithinRows([0, 0, 28, 28, 56, 56], 2)).toBe(3);
    expect(fitWithinRows([0, 28, 56], 1)).toBe(0);
  });

  it("treats sub-pixel offsets as the same row", () => {
    expect(fitWithinRows([0, 0.5, 1.5, 28, 28.4], 1)).toBe(2);
  });
});
