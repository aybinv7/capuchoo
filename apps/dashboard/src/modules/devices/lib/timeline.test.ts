import { describe, expect, it } from "vite-plus/test";
import { activityEvent, deviceEvent } from "./test-events";
import { dayKeyFormatter, dayLabel, deviceCount, groupTimeline } from "./timeline";

const utc = dayKeyFormatter("UTC");

describe("groupTimeline", () => {
  it("groups newest-first events by calendar day in the given zone", () => {
    const days = groupTimeline(
      [
        deviceEvent({ id: "3", category: "delivered", created_at: "2026-09-30T08:00:00Z" }),
        deviceEvent({ id: "2", category: "failed", created_at: "2026-09-29T23:59:59Z" }),
        deviceEvent({ id: "1", category: "delivered", created_at: "2026-09-29T00:00:00Z" }),
      ],
      utc,
    );
    expect(days.map((day) => [day.day, day.items.map((item) => item.key)])).toEqual([
      ["2026-09-30", ["3"]],
      ["2026-09-29", ["2", "1"]],
    ]);
  });

  it("places an instant on the viewer's day, not the UTC one", () => {
    const algiers = dayKeyFormatter("Africa/Algiers");
    expect(algiers("2026-09-29T23:30:00Z")).toBe("2026-09-30");
    expect(utc("2026-09-29T23:30:00Z")).toBe("2026-09-29");
    expect(utc("garbage")).toBe("unknown");
  });

  it("folds consecutive checks into one run spanning their times", () => {
    const [day] = groupTimeline(
      [
        deviceEvent({ id: "5", created_at: "2026-09-30T17:45:00Z" }),
        deviceEvent({ id: "4", created_at: "2026-09-30T12:00:00Z" }),
        deviceEvent({ id: "3", created_at: "2026-09-30T08:10:00Z" }),
        deviceEvent({ id: "2", category: "delivered", created_at: "2026-09-30T08:05:00Z" }),
        deviceEvent({ id: "1", created_at: "2026-09-30T08:00:00Z" }),
      ],
      utc,
    );
    expect(day?.items.map((item) => item.type)).toEqual(["checks", "event", "event"]);
    const run = day?.items[0];
    if (run?.type !== "checks") throw new Error("expected a run of checks");
    expect(run.events.map((event) => event.id)).toEqual(["5", "4", "3"]);
    expect(run.from).toBe("2026-09-30T08:10:00Z");
    expect(run.to).toBe("2026-09-30T17:45:00Z");
    expect(day?.items[2]).toMatchObject({ type: "event", key: "1" });
  });

  it("keys a run by its oldest check, so a new check on top keeps the key", () => {
    const older = [
      deviceEvent({ id: "2", created_at: "2026-09-30T10:00:00Z" }),
      deviceEvent({ id: "1", created_at: "2026-09-30T09:00:00Z" }),
    ];
    const before = groupTimeline(older, utc)[0]?.items[0]?.key;
    const after = groupTimeline(
      [deviceEvent({ id: "3", created_at: "2026-09-30T11:00:00Z" }), ...older],
      utc,
    )[0]?.items[0]?.key;
    expect(before).toBe("checks:1");
    expect(after).toBe(before);
  });

  it("never folds a run across midnight", () => {
    const days = groupTimeline(
      [
        deviceEvent({ id: "2", created_at: "2026-09-30T00:10:00Z" }),
        deviceEvent({ id: "1", created_at: "2026-09-29T23:50:00Z" }),
      ],
      utc,
    );
    expect(days.map((day) => day.items.map((item) => item.type))).toEqual([["event"], ["event"]]);
  });

  it("lists every check when folding is off", () => {
    const [day] = groupTimeline(
      [deviceEvent({ id: "2" }), deviceEvent({ id: "1", created_at: "2026-09-30T11:00:00Z" })],
      utc,
      false,
    );
    expect(day?.items.map((item) => item.type)).toEqual(["event", "event"]);
  });

  it("returns nothing for no events", () => {
    expect(groupTimeline([], utc)).toEqual([]);
  });
});

describe("dayLabel", () => {
  it("names today and yesterday, and dates the rest", () => {
    expect(dayLabel("2026-10-02", "2026-10-02", "2026-10-01")).toBe("Today");
    expect(dayLabel("2026-10-01", "2026-10-02", "2026-10-01")).toBe("Yesterday");
    expect(dayLabel("2026-09-28", "2026-10-02", "2026-10-01")).toBe("Mon, Sep 28");
    expect(dayLabel("2025-12-31", "2026-10-02", "2026-10-01")).toBe("Wed, Dec 31, 2025");
  });
});

describe("deviceCount", () => {
  it("counts distinct devices in an app-wide run and nothing for one device's own", () => {
    expect(
      deviceCount([
        activityEvent({ id: "1" }, "a"),
        activityEvent({ id: "2" }, "b"),
        activityEvent({ id: "3" }, "a"),
        activityEvent({ id: "4" }, null),
      ]),
    ).toBe(2);
    expect(deviceCount([deviceEvent({ id: "1" })])).toBeNull();
  });
});
