import { describe, expect, it } from "vite-plus/test";
import { SegmentBuilder } from "./segmentBuilder.js";
import { serializeEvent } from "./serialize.js";

describe("SegmentBuilder", () => {
  it("breaks before a replay checkout and flags the full snapshot", () => {
    const builder = new SegmentBuilder();
    builder.add({ k: "console", t: 10, d: { level: "log" } }, 0);
    const meta = { k: "replay" as const, t: 20, d: { type: 4 } };
    expect(builder.breaksBefore(meta)).toBe(true);
    const first = builder.close();
    expect(first).toMatchObject({ events: 1, fullSnapshot: false, startedAt: 10, endedAt: 10 });

    builder.add(meta, 0);
    builder.add({ k: "replay", t: 21, d: { type: 2 } }, 0);
    builder.add({ k: "console", t: 25, d: { level: "error" } }, 0);
    const second = builder.close();
    expect(second).toMatchObject({
      events: 3,
      fullSnapshot: true,
      errors: 1,
      startedAt: 20,
      endedAt: 25,
    });
    expect(second!.text.trim().split("\n")).toHaveLength(3);
    expect(builder.close()).toBeNull();
  });

  it("does not break before a checkout when empty", () => {
    expect(new SegmentBuilder().breaksBefore({ k: "replay", t: 1, d: { type: 4 } })).toBe(false);
  });
});

describe("serializeEvent", () => {
  it("encodes binary as base64 and bigints as text", () => {
    const line = serializeEvent({
      k: "database",
      t: 1,
      d: { bytes: new Uint8Array([1, 2, 255]), n: 5n },
    });
    expect(JSON.parse(line!)).toEqual({
      k: "database",
      t: 1,
      d: { bytes: { $b64: "AQL/" }, n: "5" },
    });
  });

  it("survives a circular structure", () => {
    const d: Record<string, unknown> = {};
    d.self = d;
    expect(JSON.parse(serializeEvent({ k: "console", t: 1, d })!)).toEqual({
      k: "console",
      t: 1,
      d: { unserializable: true },
    });
  });
});
