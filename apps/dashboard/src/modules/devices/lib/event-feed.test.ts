import { describe, expect, it } from "vite-plus/test";
import { EMPTY_FEED, mergeEvents, reconcileHead, startHistory } from "./event-feed";
import { deviceEvent } from "./test-events";

const at = (id: string, minute: number) =>
  deviceEvent({ id, created_at: `2026-09-30T12:${String(minute).padStart(2, "0")}:00Z` });

const ids = (events: readonly { id: string }[]) => events.map((event) => event.id);

describe("mergeEvents", () => {
  it("dedupes by id, keeps the first copy, and sorts newest first", () => {
    const fresh = { ...at("b", 2), status: "fresh" };
    const merged = mergeEvents([fresh, at("c", 3)], [at("b", 2), at("a", 1)]);
    expect(ids(merged)).toEqual(["c", "b", "a"]);
    expect(merged[1]?.status).toBe("fresh");
  });

  it("breaks a tie in time by id, so the order is stable", () => {
    expect(ids(mergeEvents([at("1", 5), at("2", 5)]))).toEqual(["2", "1"]);
  });
});

describe("cursor pagination", () => {
  const head = { events: [at("e", 5), at("d", 4)], next: "cur-d" };

  it("freezes the history at the head's cursor", () => {
    expect(startHistory(EMPTY_FEED, head)).toEqual({ anchor: "cur-d", pinned: head.events });
    expect(startHistory(EMPTY_FEED, { ...head, next: null })).toBe(EMPTY_FEED);
  });

  it("does not move a history that is already anchored", () => {
    const state = startHistory(EMPTY_FEED, head);
    expect(startHistory(state, { events: [at("f", 6)], next: "cur-f" })).toBe(state);
  });

  it("keeps nothing while no history is loaded", () => {
    expect(reconcileHead(EMPTY_FEED, head)).toBe(EMPTY_FEED);
  });

  it("pins head events that arrive above a loaded history", () => {
    const state = startHistory(EMPTY_FEED, head);
    const next = reconcileHead(state, { events: [at("f", 6), at("e", 5)], next: "cur-e" });
    expect(next.anchor).toBe("cur-d");
    expect(ids(next.pinned)).toEqual(["f", "e", "d"]);
  });

  it("starts over when more events arrived than a page holds, leaving a hole", () => {
    const state = startHistory(EMPTY_FEED, head);
    expect(reconcileHead(state, { events: [at("h", 8), at("g", 7)], next: "cur-g" })).toBe(
      EMPTY_FEED,
    );
  });

  it("keeps the history when the head reaches the end or is empty", () => {
    const state = startHistory(EMPTY_FEED, head);
    expect(reconcileHead(state, { events: [at("x", 9)], next: null }).anchor).toBe("cur-d");
    expect(reconcileHead(state, { events: [], next: "cur-z" }).anchor).toBe("cur-d");
  });

  it("merges head, pinned and older pages into one gap-free list", () => {
    const refreshed = { events: [at("f", 6), at("e", 5)], next: "cur-e" };
    const state = reconcileHead(startHistory(EMPTY_FEED, head), refreshed);
    const older = [at("d", 4), at("c", 3), at("b", 2)];
    expect(ids(mergeEvents(refreshed.events, state.pinned, older))).toEqual([
      "f",
      "e",
      "d",
      "c",
      "b",
    ]);
  });
});
