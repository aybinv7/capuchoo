import { describe, expect, it } from "vite-plus/test";
import { changeKey, decodeChangeset } from "./changeset";

const hex = (text: string) =>
  Uint8Array.from(text.match(/../g)!.map((pair) => Number.parseInt(pair, 16)));

/** Produced by sqlite-wasm 3.53's session extension; see the commit that added this file. */
const FIXTURES = {
  insert:
    "540501000000006974656d0012000100000000b2d05e0003036269670240000000000000000505120001000000000000000203086d696c6b20e29c9302bfd00000000000000503016e",
  update:
    "540501000000006974656d00170001000000000000000100023ff80000000000000005000002402380000000000000030178",
  delete:
    "540501000000006974656d00090001000000000000000103056272656164024023800000000000040200ff030178",
  pair: "54030102007061697200120003016b01fffffffffffffffb030176",
};

describe("decodeChangeset", () => {
  it("decodes inserts with every value type", () => {
    const changes = decodeChangeset(hex(FIXTURES.insert));
    expect(changes).toEqual([
      {
        table: "item",
        op: "insert",
        indirect: false,
        primaryKey: [true, false, false, false, false],
        old: [],
        new: [3_000_000_000, "big", 2, null, null],
      },
      {
        table: "item",
        op: "insert",
        indirect: false,
        primaryKey: [true, false, false, false, false],
        old: [],
        new: [2, "milk ✓", -0.25, null, "n"],
      },
    ]);
  });

  it("decodes an update as old and new values, unchanged columns left undefined", () => {
    const [change] = decodeChangeset(hex(FIXTURES.update));
    expect(change).toMatchObject({
      op: "update",
      old: [1, undefined, 1.5, undefined, null],
      new: [undefined, undefined, 9.75, undefined, "x"],
    });
    expect(changeKey(change!)).toBe("1");
  });

  it("decodes a delete with its blob", () => {
    const [change] = decodeChangeset(hex(FIXTURES.delete));
    expect(change!.op).toBe("delete");
    expect(change!.old.slice(0, 3)).toEqual([1, "bread", 9.75]);
    expect(change!.old[3]).toEqual(new Uint8Array([0, 255]));
  });

  it("decodes a composite key and negative integers", () => {
    const [change] = decodeChangeset(hex(FIXTURES.pair));
    expect(change).toMatchObject({
      table: "pair",
      primaryKey: [true, true, false],
      new: ["k", -5, "v"],
    });
    expect(changeKey(change!)).toBe("k·-5");
  });

  it("refuses a truncated changeset", () => {
    expect(() => decodeChangeset(hex(FIXTURES.update).subarray(0, 20))).toThrow(RangeError);
  });
});
