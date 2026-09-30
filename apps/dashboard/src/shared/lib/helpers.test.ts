import { describe, expect, it } from "vite-plus/test";
import { channel } from "../testing/fixtures";
import { reconnectDelay } from "../live/backoff";
import { orderChannels } from "./channels";
import { formatBytes, formatRelative } from "./format";
import { safeRedirect } from "./redirect";

describe("safeRedirect", () => {
  it("keeps paths inside the dashboard", () => {
    expect(safeRedirect("/apps/1/channels?x=1")).toBe("/apps/1/channels?x=1");
  });

  it("refuses other origins and loops back to sign-in", () => {
    for (const value of [
      "//evil.example",
      "https://evil.example",
      "/\\evil",
      "/javascript:alert(1)",
      "/login",
      "/invite/abc",
      42,
    ])
      expect(safeRedirect(value, "/apps")).toBe("/apps");
  });
});

describe("reconnectDelay", () => {
  it("grows exponentially, capped at 30s, with jitter in the upper half", () => {
    expect(reconnectDelay(0, () => 0)).toBe(500);
    expect(reconnectDelay(0, () => 1)).toBe(1000);
    expect(reconnectDelay(3, () => 1)).toBe(8000);
    expect(reconnectDelay(20, () => 1)).toBe(30_000);
    expect(reconnectDelay(20, () => 0)).toBe(15_000);
  });
});

describe("orderChannels", () => {
  it("lists release channels in promotion order with their clients beneath", () => {
    const rows = orderChannels([
      channel({ id: "p", name: "prod", environment: "prod" }),
      channel({ id: "acme", name: "prod-acme", kind: "client", base_channel_id: "p" }),
      channel({ id: "d", name: "dev", environment: "dev" }),
      channel({ id: "s", name: "staging", environment: "staging" }),
      channel({ id: "lost", name: "orphan", kind: "client", base_channel_id: "gone" }),
    ]);
    expect(rows.map((row) => `${row.depth}:${row.channel.name}`)).toEqual([
      "0:dev",
      "0:staging",
      "0:prod",
      "1:prod-acme",
      "1:orphan",
    ]);
  });
});

describe("format", () => {
  it("formats sizes and relative times", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(null)).toBe("—");
    const now = Date.parse("2026-09-30T12:00:00Z");
    expect(formatRelative("2026-09-30T11:58:00Z", now)).toBe("2 min. ago");
    expect(formatRelative(null, now)).toBe("never");
  });
});
