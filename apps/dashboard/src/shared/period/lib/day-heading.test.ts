import { describe, expect, it } from "vite-plus/test";
import { dayKeyFormatter, dayLabel } from "./day-heading";

describe("dayLabel", () => {
  it("names today and yesterday, and dates the rest", () => {
    expect(dayLabel("2026-10-02", "2026-10-02", "2026-10-01")).toBe("Today");
    expect(dayLabel("2026-10-01", "2026-10-02", "2026-10-01")).toBe("Yesterday");
    expect(dayLabel("2026-09-28", "2026-10-02", "2026-10-01")).toBe("Mon, Sep 28");
    expect(dayLabel("2025-12-31", "2026-10-02", "2026-10-01")).toBe("Wed, Dec 31, 2025");
  });
});

describe("dayKeyFormatter", () => {
  it("reads an instant as its day in the given zone, and garbage as unknown", () => {
    expect(dayKeyFormatter("UTC")("2026-10-01T23:30:00.000Z")).toBe("2026-10-01");
    expect(dayKeyFormatter("Africa/Algiers")("2026-10-01T23:30:00.000Z")).toBe("2026-10-02");
    expect(dayKeyFormatter("UTC")("nope")).toBe("unknown");
  });
});
