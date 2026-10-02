import { describe, expect, it } from "vite-plus/test";
import {
  attributeChips,
  attributeEntries,
  attributesText,
  normalizeAttributes,
} from "./device-attributes";

describe("normalizeAttributes", () => {
  it("keeps strings, finite numbers and booleans", () => {
    expect(
      normalizeAttributes({
        rep: "K. Haddad",
        shift: 2,
        lead: true,
        bad: Number.NaN,
        nested: { a: 1 },
        list: [1],
        empty: null,
      }),
    ).toEqual({ rep: "K. Haddad", shift: 2, lead: true });
  });

  it("reads anything that is not an object, or holds nothing usable, as none", () => {
    expect(normalizeAttributes(null)).toBeNull();
    expect(normalizeAttributes(undefined)).toBeNull();
    expect(normalizeAttributes("rep=K")).toBeNull();
    expect(normalizeAttributes(["a"])).toBeNull();
    expect(normalizeAttributes({ bad: null })).toBeNull();
  });
});

describe("attribute chips", () => {
  const attributes = { rep: "K. Haddad", employeeId: "E-1042", lead: false, shift: 2 };

  it("formats values for display, booleans as yes or no", () => {
    expect(attributeEntries(attributes)).toEqual([
      { key: "rep", value: "K. Haddad" },
      { key: "employeeId", value: "E-1042" },
      { key: "lead", value: "no" },
      { key: "shift", value: "2" },
    ]);
  });

  it("shows the first two and counts the rest", () => {
    expect(attributeChips(attributes)).toEqual({
      chips: [
        { key: "rep", value: "K. Haddad" },
        { key: "employeeId", value: "E-1042" },
      ],
      hidden: 2,
    });
    expect(attributeChips({ rep: "A" })).toEqual({
      chips: [{ key: "rep", value: "A" }],
      hidden: 0,
    });
    expect(attributeChips(null)).toEqual({ chips: [], hidden: 0 });
  });

  it("joins every attribute for exports and tooltips", () => {
    expect(attributesText({ rep: "A", lead: true })).toBe("rep: A; lead: yes");
    expect(attributesText(null)).toBe("");
  });
});
