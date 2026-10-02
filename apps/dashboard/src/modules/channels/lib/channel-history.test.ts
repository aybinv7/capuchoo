import { describe, expect, it } from "vite-plus/test";
import { dayKey } from "@/shared/period/lib/local-day";
import type { ChannelHistoryEntry } from "@/shared/types/release";
import {
  groupHistory,
  historyMarkers,
  markerLabel,
  pauseReason,
  servingSince,
} from "./channel-history";

function entry(overrides: Partial<ChannelHistoryEntry>): ChannelHistoryEntry {
  return {
    id: "h-1",
    action: "point_bundle",
    from_id: "b-1",
    to_id: "b-2",
    from_version: "1.0.0",
    to_version: "1.1.0",
    reason: null,
    created_at: "2026-09-30T10:00:00.000Z",
    actor_api_key_id: null,
    actor_email: "karim@example.com",
    ...overrides,
  };
}

describe("historyMarkers", () => {
  const days = [
    dayKey(new Date(2026, 8, 29)),
    dayKey(new Date(2026, 8, 30)),
    dayKey(new Date(2026, 9, 1)),
  ];

  it("colours each move by kind and drops those outside the chart", () => {
    const markers = historyMarkers(
      [
        entry({ id: "pause", action: "pause", created_at: new Date(2026, 9, 1, 9).toISOString() }),
        entry({
          id: "rollback",
          action: "rollback_bundle",
          to_version: "1.0.0",
          created_at: new Date(2026, 8, 30, 18).toISOString(),
        }),
        entry({ id: "deliver", created_at: new Date(2026, 8, 29, 6).toISOString() }),
        entry({ id: "old", created_at: new Date(2026, 7, 1).toISOString() }),
      ],
      days,
      "day",
    );
    expect(markers.map((marker) => [marker.key, marker.index, marker.color])).toEqual([
      ["deliver", 0, "var(--primary)"],
      ["rollback", 1, "var(--warning)"],
      ["pause", 2, "var(--muted-foreground)"],
    ]);
    expect(markers[1]?.label).toBe("Rolled back to 1.0.0 by karim@example.com");
  });

  it("names who moved the pointer", () => {
    expect(markerLabel(entry({}))).toBe("Delivered 1.1.0 by karim@example.com");
    expect(markerLabel(entry({ actor_email: null, actor_api_key_id: "k-1" }))).toBe(
      "Delivered 1.1.0 by an API key",
    );
    expect(markerLabel(entry({ action: "resume", actor_email: null }))).toBe(
      "Resumed by the system",
    );
  });
});

describe("servingSince and pauseReason", () => {
  const history = [
    entry({ id: "3", action: "pause", reason: "crash spike", created_at: "2026-10-01T00:00:00Z" }),
    entry({ id: "2", action: "rollback_bundle", to_id: "b-1", from_version: "1.1.0" }),
    entry({ id: "1", to_id: "b-2" }),
  ];

  it("finds the move that put the current bundle on the channel", () => {
    expect(servingSince(history, "b-1")).toMatchObject({ rollback: true, fromVersion: "1.1.0" });
    expect(servingSince(history, "b-2")?.rollback).toBe(false);
    expect(servingSince(history, "b-9")).toBeNull();
    expect(servingSince(history, null)).toBeNull();
  });

  it("reads the reason of the newest pause, not of one already resumed", () => {
    expect(pauseReason(history)).toBe("crash spike");
    expect(pauseReason([entry({ action: "resume" }), ...history])).toBeNull();
  });
});

describe("groupHistory", () => {
  it("groups consecutive entries by day, newest first", () => {
    const groups = groupHistory(
      [
        entry({ id: "c", created_at: "2026-10-01T09:00:00Z" }),
        entry({ id: "b", created_at: "2026-10-01T08:00:00Z" }),
        entry({ id: "a", created_at: "2026-09-29T08:00:00Z" }),
      ],
      (iso) => iso.slice(0, 10),
    );
    expect(groups.map((group) => [group.day, group.entries.map((row) => row.id)])).toEqual([
      ["2026-10-01", ["c", "b"]],
      ["2026-09-29", ["a"]],
    ]);
  });
});
