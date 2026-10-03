import { describe, expect, it } from "vite-plus/test";
import { keepReplayEvent } from "./replay-filter";

describe("keepReplayEvent", () => {
  it("drops media events on the document and keeps those on media elements", () => {
    const documents = new Set<number>();
    expect(keepReplayEvent({ type: 2, data: { node: { id: 1 } } }, documents)).toBe(true);
    expect(keepReplayEvent({ type: 3, data: { source: 7, id: 1, type: 1 } }, documents)).toBe(
      false,
    );
    expect(keepReplayEvent({ type: 3, data: { source: 7, id: 42, type: 0 } }, documents)).toBe(
      true,
    );
    expect(keepReplayEvent({ type: 3, data: { source: 0, id: 1 } }, documents)).toBe(true);
  });
});
