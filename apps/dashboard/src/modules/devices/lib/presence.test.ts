import { describe, expect, it } from "vite-plus/test";
import { devicePresence, ONLINE_WINDOW_MS } from "./presence";

const NOW = Date.parse("2026-10-02T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("devicePresence", () => {
  it("is online within fifteen minutes, inclusive", () => {
    expect(devicePresence(ago(0), NOW)).toBe("online");
    expect(devicePresence(ago(ONLINE_WINDOW_MS), NOW)).toBe("online");
    expect(devicePresence(ago(ONLINE_WINDOW_MS + 1000), NOW)).toBe("recent");
  });

  it("is recent within a day and offline beyond", () => {
    expect(devicePresence(ago(23 * 3_600_000), NOW)).toBe("recent");
    expect(devicePresence(ago(25 * 3_600_000), NOW)).toBe("offline");
  });

  it("treats a device clock ahead of the browser as just seen", () => {
    expect(devicePresence(new Date(NOW + 60_000).toISOString(), NOW)).toBe("online");
  });

  it("is unknown without a readable time", () => {
    expect(devicePresence(null, NOW)).toBe("unknown");
    expect(devicePresence("not a date", NOW)).toBe("unknown");
  });
});
