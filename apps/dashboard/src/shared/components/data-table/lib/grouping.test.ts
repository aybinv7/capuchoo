import { describe, expect, it } from "vite-plus/test";
import {
  MAX_GROUP_LEVELS,
  groupValueLabel,
  leafOriginals,
  sanitizeGrouping,
  toggleGrouping,
} from "./grouping";

describe("toggleGrouping", () => {
  it("adds levels in order and refuses one past the limit", () => {
    expect(toggleGrouping([], "channel")).toEqual(["channel"]);
    expect(toggleGrouping(["channel"], "ota")).toEqual(["channel", "ota"]);
    expect(MAX_GROUP_LEVELS).toBe(2);
    expect(toggleGrouping(["channel", "ota"], "platform")).toEqual(["channel", "ota"]);
  });

  it("removes a level together with the ones nested under it", () => {
    expect(toggleGrouping(["channel", "ota"], "channel")).toEqual([]);
    expect(toggleGrouping(["channel", "ota"], "ota")).toEqual(["channel"]);
  });
});

describe("sanitizeGrouping", () => {
  it("keeps groupable, existing, unique ids up to the limit", () => {
    const groupable = new Set(["channel", "ota", "platform"]);
    expect(sanitizeGrouping(["gone", "channel", "channel", "ota", "platform"], groupable)).toEqual([
      "channel",
      "ota",
    ]);
  });
});

describe("leafOriginals", () => {
  const leaf = (value: string) => ({ original: value, subRows: [], getIsGrouped: () => false });
  const group = (...subRows: ReturnType<typeof leaf>[]) => ({
    original: subRows[0]!.original,
    subRows,
    getIsGrouped: () => true,
  });

  it("flattens nested groups into data rows, never the group rows themselves", () => {
    expect(leafOriginals([group(leaf("a"), leaf("b")), leaf("c"), group(leaf("d"))])).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });
});

describe("groupValueLabel", () => {
  it("labels empty values, booleans and values through the column's label", () => {
    expect(groupValueLabel("")).toEqual({ text: "None", empty: true });
    expect(groupValueLabel(null)).toEqual({ text: "None", empty: true });
    expect(groupValueLabel(true)).toEqual({ text: "Yes", empty: false });
    expect(groupValueLabel("ok", (value: string) => value.toUpperCase())).toEqual({
      text: "OK",
      empty: false,
    });
    expect(groupValueLabel("", (value: string) => value || "unflavoured")).toEqual({
      text: "unflavoured",
      empty: true,
    });
  });
});
