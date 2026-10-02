import { describe, expect, it } from "vite-plus/test";
import { donutArcs } from "./donut-arcs";

describe("donutArcs", () => {
  it("lays slices end to end with a gap between them", () => {
    const arcs = donutArcs(
      [
        { key: "a", value: 3 },
        { key: "b", value: 1 },
      ],
      100,
      4,
    );
    expect(arcs).toEqual([
      { key: "a", length: 71, offset: -2, share: 0.75 },
      { key: "b", length: 21, offset: -77, share: 0.25 },
    ]);
  });

  it("draws one slice as a full ring, drops empty ones, keeps a sliver for tiny ones", () => {
    expect(
      donutArcs(
        [
          { key: "a", value: 5 },
          { key: "z", value: 0 },
        ],
        100,
        4,
      ),
    ).toEqual([{ key: "a", length: 100, offset: -0, share: 1 }]);
    const tiny = donutArcs(
      [
        { key: "a", value: 999 },
        { key: "b", value: 1 },
      ],
      100,
      4,
    );
    expect(tiny[1]!.length).toBe(1.5);
    expect(donutArcs([], 100, 4)).toEqual([]);
  });
});
