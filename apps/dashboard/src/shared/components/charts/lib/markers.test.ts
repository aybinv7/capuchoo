import { describe, expect, it } from "vite-plus/test";
import { dayKey, hourKey } from "@/shared/period/lib/local-day";
import { markersAt, placeMarkers } from "./markers";

const at = (date: Date) => date.toISOString();

describe("placeMarkers", () => {
  const days = ["2026-09-28", "2026-09-29", "2026-09-30"];

  it("puts a moment in its local day, at its share of the day", () => {
    const noon = new Date(2026, 8, 29, 12, 0, 0);
    const [marker] = placeMarkers(
      [{ key: "h-1", at: at(noon), color: "red", label: "Delivered" }],
      days,
      "day",
    );
    expect(marker).toMatchObject({ key: "h-1", index: 1, color: "red", label: "Delivered" });
    expect(marker?.offset).toBeCloseTo(0.5, 1);
  });

  it("drops moments outside the buckets or without a time, oldest first", () => {
    const markers = placeMarkers(
      [
        { key: "late", at: at(new Date(2026, 8, 30, 18)), color: "a", label: "late" },
        { key: "early", at: at(new Date(2026, 8, 28, 1)), color: "a", label: "early" },
        { key: "before", at: at(new Date(2026, 8, 20, 9)), color: "a", label: "before" },
        { key: "broken", at: "yesterday", color: "a", label: "broken" },
      ],
      days,
      "day",
    );
    expect(markers.map((marker) => marker.key)).toEqual(["early", "late"]);
    expect(markers[1]?.index).toBe(2);
  });

  it("places by minute inside an hour", () => {
    const moment = new Date(2026, 8, 29, 14, 45);
    const hours = [hourKey(new Date(2026, 8, 29, 13)), hourKey(new Date(2026, 8, 29, 14))];
    const [marker] = placeMarkers(
      [{ key: "m", at: at(moment), color: "a", label: "m" }],
      hours,
      "hour",
    );
    expect(marker?.index).toBe(1);
    expect(marker?.offset).toBeCloseTo(0.75, 2);
  });

  it("lists the markers of one bucket", () => {
    const markers = placeMarkers(
      [
        { key: "a", at: at(new Date(2026, 8, 29, 9)), color: "a", label: "a" },
        { key: "b", at: at(new Date(2026, 8, 29, 10)), color: "a", label: "b" },
      ],
      [dayKey(new Date(2026, 8, 29))],
      "day",
    );
    expect(markersAt(markers, 0).map((marker) => marker.key)).toEqual(["a", "b"]);
    expect(markersAt(markers, 1)).toEqual([]);
  });
});
