import { describe, expect, it } from "vite-plus/test";
import type { RecordingSegmentMeta } from "@capuchoo/core";
import { segmentsToEvict } from "./eviction.js";

function segment(seq: number, endedAt: number, fullSnapshot = false): RecordingSegmentMeta {
  return {
    sessionId: "s",
    seq,
    startedAt: endedAt - 10,
    endedAt,
    events: 1,
    bytes: 100,
    fullSnapshot,
    errors: 0,
    final: false,
  };
}

const size = () => 100;

describe("segmentsToEvict", () => {
  it("drops whole replay groups, oldest first, so playback still starts at a full snapshot", () => {
    const segments = [
      segment(0, 100, true),
      segment(1, 200),
      segment(2, 300, true),
      segment(3, 400),
      segment(4, 500, true),
    ];
    expect(segmentsToEvict(segments, { maxMs: 10_000, maxBytes: 300 }, 500, size)).toEqual([0, 1]);
  });

  it("drops groups older than the window", () => {
    const segments = [segment(0, 100, true), segment(1, 200), segment(2, 5000, true)];
    expect(segmentsToEvict(segments, { maxMs: 1000, maxBytes: 1e9 }, 5500, size)).toEqual([0, 1]);
  });

  it("always keeps the newest group, even past the limits", () => {
    const segments = [segment(0, 100, true), segment(1, 200)];
    expect(segmentsToEvict(segments, { maxMs: 1, maxBytes: 1 }, 100_000, size)).toEqual([]);
  });

  it("treats every segment as a group when replay is off", () => {
    const segments = [segment(0, 100), segment(1, 200), segment(2, 300)];
    expect(segmentsToEvict(segments, { maxMs: 1e9, maxBytes: 200 }, 300, size)).toEqual([0]);
  });

  it("keeps segments recorded before the first full snapshot with that group", () => {
    const segments = [segment(0, 100), segment(1, 200, true), segment(2, 300)];
    expect(segmentsToEvict(segments, { maxMs: 1e9, maxBytes: 200 }, 300, size)).toEqual([0]);
  });
});
