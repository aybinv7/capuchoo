import { describe, expect, it } from "vite-plus/test";
import { categoryParam, EVENT_FILTERS, isEventFilter, toCategory } from "./event-filters";

describe("event filters", () => {
  it("offers All plus the five categories worth filtering by, in order", () => {
    expect(EVENT_FILTERS.map((option) => option.label)).toEqual([
      "All",
      "Delivered",
      "Failed",
      "Checks",
      "Downloads",
      "Lifecycle",
    ]);
  });

  it("maps each chip to the category parameter, All to none", () => {
    expect(categoryParam("all")).toBe("");
    expect(categoryParam("check")).toBe("check");
    expect(categoryParam("downloading")).toBe("downloading");
  });

  it("accepts only known filters from the URL", () => {
    expect(isEventFilter("failed")).toBe(true);
    expect(isEventFilter("cancelled")).toBe(false);
    expect(isEventFilter("")).toBe(false);
  });

  it("reads an unknown or missing category as other", () => {
    expect(toCategory("delivered")).toBe("delivered");
    expect(toCategory("teleported")).toBe("other");
    expect(toCategory(undefined)).toBe("other");
  });
});
