import { describe, expect, it } from "vite-plus/test";
import { bucketTitle, tickLabel } from "./bucket-label";

describe("bucket labels", () => {
  it("labels days as day/month and hours as the hour", () => {
    expect(tickLabel("2026-09-26", "day")).toBe("26/09");
    expect(tickLabel("2026-09-26T14", "hour")).toBe("14h");
    expect(tickLabel("2026-09-27T00", "hour")).toBe("27/09");
  });

  it("titles a tooltip with the weekday, and the hour when there is one", () => {
    expect(bucketTitle("2026-09-26", "day")).toBe("Sat 26 Sep");
    expect(bucketTitle("2026-09-26T09", "hour")).toBe("Sat 26 Sep · 09:00");
  });

  it("passes an unreadable key through", () => {
    expect(tickLabel("week 39", "day")).toBe("week 39");
    expect(bucketTitle("week 39", "hour")).toBe("week 39");
  });
});
