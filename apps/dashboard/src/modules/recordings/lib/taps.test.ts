import { describe, expect, it } from "vite-plus/test";
import { bugReport, linkAt } from "./bug-report";
import { adjacentIssue, issuesOf } from "./issues";
import { emptyLanes } from "./lanes";
import { rageTaps, recentTaps, tapsOf } from "./taps";
import type { RecordingSession } from "../types/recordings.types";

const touch = (timestamp: number, x: number, y: number, type = 7) => ({
  type: 3,
  timestamp,
  data: { source: 2, type, x, y },
});

describe("taps", () => {
  it("collapses a touch and its click into one tap", () => {
    const taps = tapsOf([touch(1000, 50, 80), touch(1040, 51, 80, 2), touch(2000, 200, 300)]);
    expect(taps).toEqual([
      { t: 1000, x: 50, y: 80 },
      { t: 2000, x: 200, y: 300 },
    ]);
  });

  it("finds a rage tap in a burst on one spot, once", () => {
    const taps = tapsOf([
      touch(1000, 100, 100),
      touch(1200, 104, 98),
      touch(1400, 99, 103),
      touch(1550, 101, 100),
      touch(5000, 100, 100),
    ]);
    expect(rageTaps(taps).map((tap) => tap.t)).toEqual([1400]);
  });

  it("does not call spread-out taps rage", () => {
    const taps = tapsOf([touch(1000, 10, 10), touch(1200, 300, 10), touch(1400, 10, 400)]);
    expect(rageTaps(taps)).toEqual([]);
  });

  it("keeps only taps just before the playhead for ripples", () => {
    const taps = tapsOf([touch(1000, 1, 1), touch(2000, 2, 2)]);
    expect(recentTaps(taps, 2300).map((tap) => tap.t)).toEqual([2000]);
  });
});

describe("issues", () => {
  const lanes = emptyLanes();
  lanes.console.push({
    id: "c",
    t: 5000,
    level: "error",
    text: "boom\nat x",
    stack: null,
    site: null,
    source: "uncaught",
  });
  lanes.network.push({
    id: "n",
    t: 2000,
    transport: "fetch",
    method: "POST",
    url: "https://api.test/orders",
    status: 500,
    duration: 30,
    error: null,
    traceId: null,
    requestHeaders: {},
    responseHeaders: {},
    requestBody: null,
    responseBody: null,
    responseSize: null,
  });
  const issues = issuesOf(lanes, [{ t: 8000, x: 0, y: 0 }]);

  it("orders errors, failed requests and rage taps by time", () => {
    expect(issues.map((issue) => issue.kind)).toEqual(["request", "error", "rage"]);
  });

  it("steps to the next and previous issue around the playhead", () => {
    expect(adjacentIssue(issues, 2000, 1)?.t).toBe(5000);
    expect(adjacentIssue(issues, 5000, -1)?.t).toBe(2000);
    expect(adjacentIssue(issues, 9000, 1)).toBeNull();
  });

  it("walks every issue when each jump lands a lead before it", () => {
    const lead = 1500;
    const issues = [15_000, 16_000, 31_000].map((t) => ({ t, kind: "error" as const, label: "x" }));
    const visited: number[] = [];
    let playhead = 0;
    for (;;) {
      const next = adjacentIssue(issues, playhead + lead, 1);
      if (!next) break;
      visited.push(next.t);
      playhead = next.t - lead;
    }
    expect(visited).toEqual([15_000, 16_000, 31_000]);
    expect(adjacentIssue(issues, playhead + lead, -1)?.t).toBe(16_000);
  });

  it("writes a bug report with links at each moment", () => {
    const session = {
      id: "s",
      device_id: "d-1",
      device: {
        model: "Pixel",
        manufacturer: "Google",
        osVersion: "15",
        webview: "153",
        screen: null,
      },
      version_name: "3.1.0",
      version_code: 42,
      channel: "prod",
      start: "shake",
      started_at: "2026-10-03T10:00:00Z",
      duration_ms: 90_000,
      note: "Commande bloquée",
    } as unknown as RecordingSession;
    const report = bugReport({
      session,
      issues,
      origin: 1000,
      pageUrl: "https://dash.test/apps/a/recordings/s",
    });
    expect(report).toContain("### Shake report - Google Pixel");
    expect(report).toContain("> Commande bloquée");
    expect(report).toContain(
      `[0:01](${linkAt("https://dash.test/apps/a/recordings/s", 1000)}) POST`,
    );
    expect(report).toContain("[0:04]");
  });
});
