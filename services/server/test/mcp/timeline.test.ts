import { describe, expect, it } from "vite-plus/test";
import { buildTimeline, clock, safeUrl } from "../../src/mcp/timeline/build-timeline";

const START = 1_790_000_000_000;
const at = (seconds: number) => START + seconds * 1000;
const options = { focus: "errors" as const, beforeMs: 10_000, afterMs: 2000, maxItems: 100 };

const events = [
  { k: "marker" as const, t: at(1), d: { kind: "route", url: "/orders" } },
  {
    k: "marker" as const,
    t: at(5),
    d: { kind: "step", action: "tap", target: { name: "New order", css: "button.new" } },
  },
  { k: "console" as const, t: at(6), d: { level: "log", text: "loaded" } },
  {
    k: "network" as const,
    t: at(8),
    d: { method: "POST", url: "https://api.test/sync", status: 504, duration: 2500 },
  },
  {
    k: "marker" as const,
    t: at(40),
    d: {
      kind: "step",
      action: "type",
      target: { name: "PIN", id: "pin" },
      masked: true,
      value: null,
    },
  },
  {
    k: "database" as const,
    t: at(41),
    d: {
      kind: "rows",
      changes: [
        { table: "orders", op: "update" },
        { table: "orders", op: "update" },
      ],
    },
  },
  {
    k: "console" as const,
    t: at(45),
    d: {
      level: "error",
      text: "Uncaught RangeError: Invalid time value",
      stack: null,
      source: "uncaught",
    },
  },
  {
    k: "marker" as const,
    t: at(50),
    d: { kind: "trigger", trigger: "shake", note: "date picker broke" },
  },
];

describe("session timelines", () => {
  it("keeps what led to an error, failed requests and the user's report", () => {
    const timeline = buildTimeline(events, START, at(60), options);
    expect(timeline.counts).toMatchObject({
      steps: 2,
      errors: 1,
      requests: 1,
      failed_requests: 1,
      slow_requests: 1,
    });
    expect(timeline.items.map((item) => `${clock(item.at_ms)} ${item.text}`)).toEqual([
      "0:08 POST api.test/sync 504 2500ms [FAILED, SLOW]",
      '0:40 type "PIN" (#pin) = •••',
      "0:41 db update orders ×2",
      "0:45 Uncaught RangeError: Invalid time value",
      '0:50 recording raised by shake: "date picker broke"',
    ]);
  });

  it("keeps everything but logs when nothing broke, and the newest when it must cut", () => {
    const calm = events.filter((event) => event.k !== "console");
    expect(buildTimeline(calm, START, at(60), options).items).toHaveLength(5);
    const all = buildTimeline(events, START, at(60), { ...options, focus: "all", maxItems: 3 });
    expect(all.omitted).toBe(5);
    expect(all.items.map((item) => item.kind)).toEqual(["database", "error", "trigger"]);
  });

  it("hides query values and shortens what is long", () => {
    expect(safeUrl("https://api.test/orders?token=abc&page=2&token=def")).toBe(
      "api.test/orders?token=…&page=…",
    );
    expect(safeUrl("/relative/path?x=1")).toBe("/relative/path");
  });
});
