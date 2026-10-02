import { describe, expect, it } from "vite-plus/test";
import { toDeviceFilters, withChannelFilter } from "./device-filters";

describe("device filters", () => {
  it("maps single-value facets to query parameters", () => {
    expect(
      toDeviceFilters("  pixel ", [
        { id: "channel", value: ["c-1"] },
        { id: "last_seen", value: ["7"] },
      ]),
    ).toEqual({
      search: "pixel",
      channelId: "c-1",
      activeDays: "7",
      version: "",
      behind: false,
    });
  });

  it("carries the URL-only scopes: a version and devices behind their channel", () => {
    expect(toDeviceFilters("", [], { version: " 1.9.0 ", behind: true })).toMatchObject({
      version: "1.9.0",
      behind: true,
    });
  });

  it("drops values the endpoint does not accept", () => {
    expect(
      toDeviceFilters("", [
        { id: "last_seen", value: ["365"] },
        { id: "channel", value: 3 },
      ]),
    ).toEqual({
      search: "",
      channelId: "",
      activeDays: "",
      version: "",
      behind: false,
    });
  });

  it("sets or clears the channel facet, keeping the others", () => {
    const filters = [{ id: "last_seen", value: ["7"] }];
    expect(withChannelFilter(filters, "c-1")).toEqual([
      { id: "last_seen", value: ["7"] },
      { id: "channel", value: ["c-1"] },
    ]);
    expect(withChannelFilter([...filters, { id: "channel", value: ["c-0"] }], "")).toEqual(filters);
  });
});
