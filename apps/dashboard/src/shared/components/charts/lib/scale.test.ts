import { describe, expect, it } from "vite-plus/test";
import { niceMax } from "./scale";

describe("niceMax", () => {
  it("rounds up to 1, 2 or 5 times a power of ten", () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(7)).toBe(10);
    expect(niceMax(130)).toBe(200);
    expect(niceMax(450)).toBe(500);
  });
});
