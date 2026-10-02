import { describe, expect, it } from "vite-plus/test";
import {
  DEVICE_ATTRIBUTE_LIMITS,
  applyAttributePatch,
  normaliseDeviceAttributes,
} from "./device-attributes.js";

describe("normaliseDeviceAttributes", () => {
  it("keeps strings, finite numbers and booleans, trimmed and clipped", () => {
    const result = normaliseDeviceAttributes({
      rep: "  K. Haddad ",
      employeeId: 1042,
      trained: true,
      notes: "x".repeat(500),
    });
    expect(result?.attributes).toEqual({
      rep: "K. Haddad",
      employeeId: 1042,
      trained: true,
      notes: "x".repeat(DEVICE_ATTRIBUTE_LIMITS.valueLength),
    });
    expect(result?.dropped).toEqual([]);
  });

  it("drops what it will not store and says why", () => {
    const result = normaliseDeviceAttributes({
      "1bad": "x",
      "has space": "x",
      nested: { a: 1 },
      empty: "  ",
      infinite: Number.POSITIVE_INFINITY,
      ok: "yes",
    });
    expect(result?.attributes).toEqual({ ok: "yes" });
    expect(result?.dropped.map((entry) => entry.key)).toEqual([
      "1bad",
      "has space",
      "nested",
      "empty",
      "infinite",
    ]);
  });

  it("caps the number of keys and the total size", () => {
    const many = Object.fromEntries(Array.from({ length: 30 }, (_, index) => [`k${index}`, "v"]));
    expect(Object.keys(normaliseDeviceAttributes(many)!.attributes)).toHaveLength(20);
    const heavy = Object.fromEntries(
      Array.from({ length: 20 }, (_, index) => [`key${index}`, "y".repeat(200)]),
    );
    const result = normaliseDeviceAttributes(heavy)!;
    expect(new TextEncoder().encode(JSON.stringify(result.attributes)).length).toBeLessThanOrEqual(
      DEVICE_ATTRIBUTE_LIMITS.totalBytes,
    );
    expect(result.dropped.some((entry) => entry.reason.includes("bytes"))).toBe(true);
  });

  it("refuses what is not an object", () => {
    expect(normaliseDeviceAttributes("rep=karim")).toBeNull();
    expect(normaliseDeviceAttributes([1, 2])).toBeNull();
    expect(normaliseDeviceAttributes(null)).toBeNull();
  });
});

describe("applyAttributePatch", () => {
  it("replaces, adds and removes keys", () => {
    expect(
      applyAttributePatch({ rep: "A", route: "North" }, { route: null, store: "S12" }),
    ).toEqual({ rep: "A", store: "S12" });
  });
});
