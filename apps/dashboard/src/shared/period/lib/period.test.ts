import { afterAll, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import {
  DEFAULT_PERIOD,
  oldestDay,
  parsePeriod,
  periodBounds,
  periodLabel,
  periodQuery,
  rangeLabel,
  resolvePeriod,
  type Period,
} from "./period";

beforeAll(() => {
  vi.stubEnv("TZ", "Europe/Paris");
});

afterAll(() => {
  vi.unstubAllEnvs();
});

const NOW = () => new Date(2026, 9, 2, 14, 30);
const preset = (value: Extract<Period, { kind: "preset" }>["preset"]): Period => ({
  kind: "preset",
  preset: value,
});
const days = (period: Period, retention?: number) => {
  const resolved = resolvePeriod(period, NOW(), retention);
  return [resolved.firstDay, resolved.lastDay, resolved.days];
};

describe("parsePeriod", () => {
  it("reads a preset, and defaults to the last 7 days", () => {
    expect(parsePeriod({})).toEqual(DEFAULT_PERIOD);
    expect(parsePeriod({ range: "30d" })).toEqual(preset("30d"));
    expect(parsePeriod({ range: ["last-month"] })).toEqual(preset("last-month"));
  });

  it("reads a custom range of inclusive local days", () => {
    expect(parsePeriod({ from: "2026-09-12", to: "2026-09-18" })).toEqual({
      kind: "custom",
      start: "2026-09-12",
      end: "2026-09-18",
    });
  });

  it("falls back to the default on anything unreadable", () => {
    expect(parsePeriod({ range: "90d" })).toEqual(DEFAULT_PERIOD);
    expect(parsePeriod({ from: "2026-02-30", to: "2026-03-02" })).toEqual(DEFAULT_PERIOD);
    expect(parsePeriod({ from: "2026-09-18", to: "2026-09-12" })).toEqual(DEFAULT_PERIOD);
    expect(parsePeriod({ from: "2026-09-12" })).toEqual(DEFAULT_PERIOD);
    expect(parsePeriod({ from: "12/09/2026", to: "18/09/2026" })).toEqual(DEFAULT_PERIOD);
  });

  it("round-trips through the query, leaving the default out of the URL", () => {
    const custom: Period = { kind: "custom", start: "2026-09-12", end: "2026-09-18" };
    expect(periodQuery(DEFAULT_PERIOD)).toEqual({});
    expect(periodQuery(preset("today"))).toEqual({ range: "today" });
    expect(parsePeriod(periodQuery(custom))).toEqual(custom);
    expect(parsePeriod(periodQuery(preset("month")))).toEqual(preset("month"));
  });
});

describe("resolvePeriod", () => {
  it("pins each preset to whole local days ending today or before", () => {
    expect(days(preset("today"))).toEqual(["2026-10-02", "2026-10-02", 1]);
    expect(days(preset("yesterday"))).toEqual(["2026-10-01", "2026-10-01", 1]);
    expect(days(preset("7d"))).toEqual(["2026-09-26", "2026-10-02", 7]);
    expect(days(preset("30d"))).toEqual(["2026-09-03", "2026-10-02", 30]);
    expect(days(preset("month"))).toEqual(["2026-10-01", "2026-10-02", 2]);
    expect(days(preset("last-month"))).toEqual(["2026-09-01", "2026-09-30", 30]);
    expect(days(preset("all"), 90)).toEqual(["2026-07-05", "2026-10-02", 90]);
    expect(days(preset("all"))).toEqual(["2026-07-05", "2026-10-02", 90]);
  });

  it("ends today at the next local midnight", () => {
    const today = resolvePeriod(preset("today"), NOW());
    expect(today.start.getTime()).toBe(new Date(2026, 9, 2).getTime());
    expect(today.end.getTime()).toBe(new Date(2026, 9, 3).getTime());
  });

  it("cuts a custom range at tomorrow and at a year", () => {
    expect(days({ kind: "custom", start: "2026-09-30", end: "2026-10-10" })).toEqual([
      "2026-09-30",
      "2026-10-02",
      3,
    ]);
    expect(days({ kind: "custom", start: "2024-01-01", end: "2026-10-02" })[2]).toBe(365);
    expect(days({ kind: "custom", start: "2026-11-01", end: "2026-11-05" })).toEqual([
      "2026-09-26",
      "2026-10-02",
      7,
    ]);
  });

  it("is DST-safe: a spring-forward day is one day of 23 hours", () => {
    expect(new Date(2026, 2, 29, 12).getTimezoneOffset()).toBe(-120);
    const resolved = resolvePeriod(
      { kind: "custom", start: "2026-03-29", end: "2026-03-29" },
      NOW(),
    );
    expect(resolved.start.toISOString()).toBe("2026-03-28T23:00:00.000Z");
    expect(resolved.end.toISOString()).toBe("2026-03-29T22:00:00.000Z");
    expect(resolved.days).toBe(1);
    const week = resolvePeriod({ kind: "custom", start: "2026-03-26", end: "2026-04-01" }, NOW());
    expect(week.days).toBe(7);
    expect(week.lastDay).toBe("2026-04-01");
  });

  it("starts the kept history at the retention edge", () => {
    expect(oldestDay(NOW(), 7)).toBe("2026-09-26");
    expect(oldestDay(NOW(), null)).toBe("2026-07-05");
  });
});

describe("labels and bounds", () => {
  it("names presets and dates custom ranges", () => {
    const now = NOW();
    const week = resolvePeriod(preset("7d"), now);
    expect(periodLabel(preset("7d"), week, now)).toBe("Last 7 days");
    expect(rangeLabel(week, now)).toBe("26 Sep – 2 Oct");
    const custom: Period = { kind: "custom", start: "2026-09-12", end: "2026-09-18" };
    expect(periodLabel(custom, resolvePeriod(custom, now), now)).toBe("12 Sep – 18 Sep");
    expect(rangeLabel(resolvePeriod(preset("today"), now), now)).toBe("2 Oct");
    const winter: Period = { kind: "custom", start: "2025-12-29", end: "2026-01-02" };
    expect(rangeLabel(resolvePeriod(winter, now), now)).toBe("29 Dec 2025 – 2 Jan 2026");
  });

  it("sends instants for a window and nothing for all kept history", () => {
    const now = NOW();
    const week = resolvePeriod(preset("7d"), now);
    expect(periodBounds(preset("7d"), week)).toEqual({
      from: week.start.toISOString(),
      to: week.end.toISOString(),
    });
    expect(periodBounds(preset("all"), resolvePeriod(preset("all"), now))).toEqual({
      from: null,
      to: null,
    });
  });
});
