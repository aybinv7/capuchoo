import { describe, expect, it } from "vite-plus/test";
import { dominantSize, insertSize, sizeAt, type SizeAt } from "./viewport-sizes";

const portrait = { width: 393, height: 852 };
const landscape = { width: 853, height: 384 };

describe("viewport sizes", () => {
  it("lays the page out for the size the screen held longest, not the first one", () => {
    const sizes: SizeAt[] = [
      { t: 0, ...landscape },
      { t: 900, ...portrait },
    ];
    expect(dominantSize(sizes, 88_000)).toEqual(portrait);
  });

  it("counts every stretch a size was held, across rotations", () => {
    const sizes: SizeAt[] = [
      { t: 0, ...portrait },
      { t: 10_000, ...landscape },
      { t: 30_000, ...portrait },
    ];
    expect(dominantSize(sizes, 35_000)).toEqual(landscape);
    expect(dominantSize(sizes, 60_000)).toEqual(portrait);
  });

  it("ignores a hidden app's empty viewport", () => {
    const sizes: SizeAt[] = [
      { t: 0, ...portrait },
      { t: 1000, width: 0, height: 0 },
    ];
    expect(dominantSize(sizes, 90_000)).toEqual(portrait);
    expect(dominantSize([], 1000)).toBeNull();
  });

  it("keeps late segments in time order and answers for any moment", () => {
    const sizes: SizeAt[] = [];
    insertSize(sizes, { t: 5000, ...landscape });
    insertSize(sizes, { t: 0, ...portrait });
    expect(sizes.map((size) => size.t)).toEqual([0, 5000]);
    expect(sizeAt(sizes, 4999)).toMatchObject(portrait);
    expect(sizeAt(sizes, 5000)).toMatchObject(landscape);
    expect(sizeAt(sizes, -1)).toMatchObject(portrait);
  });
});
