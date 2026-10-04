import { describe, expect, it } from "vite-plus/test";
import { RouteName } from "@/shared/router/route-names";
import type { RecordingStats } from "@/shared/types/recording-stats";
import type { AppStats } from "@/shared/types/stats";
import { attentionItems } from "./attention";

function recording(overrides: Partial<RecordingStats> = {}): RecordingStats {
  return {
    days: 14,
    totals: {
      sessions: 40,
      error_sessions: 4,
      reports: 2,
      devices: 12,
      bytes: 1,
      duration_ms: 1,
      live_now: 0,
      error_rate: 0.1,
      avg_duration_ms: 1,
    },
    daily: [],
    starts: [],
    versions: [],
    issues: { open: 0, regressed: 0, new: 0, top: [] },
    recorders: { total: 10, online: 4, degraded: 0, live_rules: 0 },
    ...overrides,
  };
}

function delivery(overrides: Partial<AppStats> = {}): AppStats {
  return {
    days: 14,
    totals: {
      checks: 100,
      installs: 90,
      failures: 2,
      devices: 30,
      active_24h: 20,
      success_rate: 90 / 92,
    },
    daily: [],
    versions: [],
    channels: [],
    ...overrides,
  };
}

const issue = (id: string, status: "open" | "regressed") => ({
  id,
  message: `Error ${id}`,
  frame: "Order.vue:1",
  status,
  first_seen: "2026-10-01T00:00:00Z",
  last_seen: "2026-10-04T00:00:00Z",
  occurrences: 4,
  sessions: 3,
  devices: 2,
});

const version = (name: string, sessions: number, errors: number) => ({
  version: name,
  sessions,
  error_sessions: errors,
  devices: 4,
  last_seen: "2026-10-04T00:00:00Z",
});

describe("what needs attention", () => {
  it("says nothing when all is well", () => {
    expect(attentionItems(delivery(), recording())).toEqual([]);
    expect(attentionItems(undefined, undefined)).toEqual([]);
  });

  it("puts regressions and a breaking release before new errors and failing channels", () => {
    const items = attentionItems(
      delivery({
        channels: [
          {
            channel_id: "c1",
            name: "prod-acme",
            devices: 12,
            active_24h: 9,
            on_current: 10,
            installs_24h: 4,
            failures_24h: 3,
            installs_7d: 40,
            failures_7d: 5,
          },
        ],
      }),
      recording({
        issues: {
          open: 2,
          regressed: 1,
          new: 2,
          top: [issue("a", "open"), issue("b", "regressed")],
        },
        versions: [version("2.0.0", 10, 6), version("1.9.0", 30, 3)],
      }),
    );
    expect(items.map((item) => item.kind)).toEqual(["regression", "release", "errors", "delivery"]);
    expect(items[0]!.title).toBe("Error b");
    expect(items[1]!.to).toEqual({
      name: RouteName.recordings,
      query: { version: "2.0.0", errors: "1" },
    });
    expect(items[3]!.title).toBe("prod-acme: 3 failed installs in 24 hours");
  });

  it("names low install success only when no single channel explains it", () => {
    const low = delivery({
      totals: {
        checks: 0,
        installs: 60,
        failures: 20,
        devices: 30,
        active_24h: 20,
        success_rate: 0.75,
      },
    });
    expect(attentionItems(low, recording()).map((item) => item.id)).toEqual(["delivery:success"]);
  });

  it("warns about recorders shedding sessions and points at live ones", () => {
    const items = attentionItems(
      delivery(),
      recording({
        recorders: { total: 10, online: 4, degraded: 1, live_rules: 1 },
        totals: { ...recording().totals, live_now: 2 },
      }),
    );
    expect(items.map((item) => [item.kind, item.title])).toEqual([
      ["recorder", "1 recorder is dropping recordings"],
      ["live", "2 sessions streaming now"],
    ]);
  });
});
