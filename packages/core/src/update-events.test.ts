import { describe, expect, it } from "vite-plus/test";
import {
  classifyUpdateEvent,
  successRate,
  summariseEvents,
  type EventSummary,
} from "./update-events.js";

/**
 * The names in this file are the ones a live table actually held.
 *
 * 34 rows for the testbed: `get` (29), `app_moved_to_foreground` (4),
 * `app_moved_to_background` (1). The dashboard counted downloads as
 * `.in("action", ["downloaded", "install"])`, and "downloaded" is a name
 * nothing has ever written - so the Downloads card could only ever show 0, and
 * did, and read as "nobody is updating".
 */
describe("the names the plugin actually sends", () => {
  it.each([
    ["get", "check"],
    ["app_moved_to_foreground", "lifecycle"],
    ["app_moved_to_background", "lifecycle"],
    ["set", "delivered"],
    ["download_complete", "delivered"],
    ["install", "delivered"],
    ["set_fail", "failed"],
    ["download_fail", "failed"],
    ["update_fail", "failed"],
    ["cancel", "cancelled"],
  ])("%s is %s", (action, expected) => {
    expect(classifyUpdateEvent(action)).toBe(expected);
  });

  it("does not recognise the name the dashboard was looking for", () => {
    // "downloaded" is not in anyone's vocabulary. Kept as a test so the next
    // person who invents a name finds out here rather than from a zero.
    expect(classifyUpdateEvent("downloaded")).toBe("other");
  });
});

describe("failures are read as failures", () => {
  /**
   * `download_fail` shares a prefix with `download_complete` and `set_fail`
   * with `set`. Matching success first would file a broken rollout as a perfect
   * one - the direction of error that hides an outage.
   */
  it("checks for failure before success", () => {
    expect(classifyUpdateEvent("set_fail")).toBe("failed");
    expect(classifyUpdateEvent("download_fail")).toBe("failed");
  });

  it.each(["checksum_fail", "decrypt_fail", "rollback", "update_error", "DOWNLOAD_FAIL"])(
    "%s is a failure",
    (action) => {
      expect(classifyUpdateEvent(action)).toBe("failed");
    },
  );
});

describe("progress is not delivery", () => {
  /**
   * The plugin emits `download_10`, `download_20` and so on. Counting those as
   * deliveries inflates the total by however many progress ticks happened to
   * fire, which is a property of connection speed rather than of updating.
   */
  it.each(["download", "download_10", "download_20", "download_100"])(
    "%s is only downloading",
    (action) => {
      expect(classifyUpdateEvent(action)).toBe("downloading");
    },
  );

  it("still treats download_complete as a delivery", () => {
    expect(classifyUpdateEvent("download_complete")).toBe("delivered");
  });
});

describe("nothing is silently dropped", () => {
  it.each([null, undefined, "", "   "])("%s is other, not a crash", (action) => {
    expect(classifyUpdateEvent(action)).toBe("other");
  });

  it("counts an unknown name rather than ignoring it", () => {
    // The vocabulary grows. A new event must show up somewhere, or totals drift
    // away from the table without anyone noticing.
    const summary = summariseEvents(["something_new"]);

    expect(summary.other).toBe(1);
    expect(summary.total).toBe(1);
  });

  it("totals every event exactly once", () => {
    const actions = ["get", "set", "set_fail", "download_20", "cancel", "app_moved_to_background"];
    const summary = summariseEvents(actions);
    const counted =
      summary.delivered +
      summary.downloading +
      summary.failed +
      summary.check +
      summary.lifecycle +
      summary.cancelled +
      summary.other;

    expect(counted).toBe(actions.length);
    expect(summary.total).toBe(actions.length);
  });

  it("is case-insensitive, because the column is free text", () => {
    expect(classifyUpdateEvent("SET")).toBe("delivered");
    expect(classifyUpdateEvent(" Get ")).toBe("check");
  });
});

describe("the success rate", () => {
  const of = (over: Partial<EventSummary>): EventSummary =>
    summariseEvents([]) && { ...summariseEvents([]), ...over };

  it("is deliveries over attempts", () => {
    expect(successRate(of({ delivered: 9, failed: 1 }))).toBe(90);
  });

  /**
   * Null, not 100. A channel nobody has updated on is not a channel with a
   * perfect record - and the card this replaces hard-coded "98.5%", which said
   * exactly the wrong thing in exactly that case.
   */
  it("is unknown when nothing has been attempted", () => {
    expect(successRate(of({ delivered: 0, failed: 0 }))).toBeNull();
  });

  it("ignores checks and lifecycle events", () => {
    // 29 of 34 events in the real table were `get`. Including them would drown
    // the ratio and produce a number that only ever rises.
    expect(successRate(of({ delivered: 1, failed: 1, check: 29, lifecycle: 5 }))).toBe(50);
  });

  it("reports one decimal, not fifteen", () => {
    expect(successRate(of({ delivered: 2, failed: 1 }))).toBe(66.7);
  });
});
