import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createNetworkTrack, type NetworkEntry } from "./network.js";

const logger = { warn: vi.fn(), error: vi.fn() };
let original: typeof fetch;
let pushed: NetworkEntry[];

beforeEach(() => {
  original = window.fetch;
  pushed = [];
});
afterEach(() => {
  window.fetch = original;
});

function start(
  bodies = false,
  options: Parameters<typeof createNetworkTrack>[0] = {},
  response = new Response('{"ok":true}', {
    status: 201,
    headers: { "content-type": "application/json" },
  }),
) {
  const inner = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => response.clone());
  window.fetch = inner as typeof fetch;
  const track = createNetworkTrack(options, () => ({
    bodies,
    maxBodyBytes: 1024,
    selfPrefix: "http://server.test/api/recording",
  }));
  track.start({ push: (_kind, data) => pushed.push(data as NetworkEntry), logger });
  return { track, inner };
}

describe("network track", () => {
  it("records a fetch with redacted credentials and no bodies by default", async () => {
    const { track } = start();
    await fetch("http://api.test/orders", {
      method: "post",
      headers: { authorization: "Bearer secret", "x-trace": "1" },
      body: '{"qty":1}',
    });
    expect(pushed).toHaveLength(1);
    expect(pushed[0]).toMatchObject({
      method: "POST",
      url: "http://api.test/orders",
      status: 201,
      requestHeaders: { authorization: "[redacted]", "x-trace": "1" },
      requestBody: null,
      responseBody: null,
    });
    track.stop();
  });

  it("reads textual bodies when the policy asks", async () => {
    const { track } = start(true);
    await fetch("http://api.test/orders", { method: "POST", body: '{"qty":1}' });
    await vi.waitFor(() => expect(pushed).toHaveLength(1));
    expect(pushed[0]).toMatchObject({ requestBody: '{"qty":1}', responseBody: '{"ok":true}' });
    track.stop();
  });

  it("never records the recorder's own uploads", async () => {
    const { track, inner } = start();
    await fetch("http://server.test/api/recording/segments", { method: "POST" });
    expect(inner).toHaveBeenCalledTimes(1);
    expect(pushed).toHaveLength(0);
    track.stop();
  });

  it("adds a traceparent only where the app allows it", async () => {
    const { track, inner } = start(false, {
      propagateTrace: (url) => url.hostname === "odoo.test",
    });
    await fetch("http://odoo.test/web/dataset");
    await fetch("http://other.test/x");
    const first = new Headers(inner.mock.calls[0]![1]!.headers);
    expect(first.get("traceparent")).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
    expect(pushed[0]!.traceId).toBe(first.get("traceparent")!.split("-")[1]);
    expect(inner.mock.calls[1]![1]).toBeUndefined();
    track.stop();
  });

  it("records a failed request and rethrows it", async () => {
    const inner = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    window.fetch = inner as unknown as typeof fetch;
    const track = createNetworkTrack({}, () => ({
      bodies: false,
      maxBodyBytes: 0,
      selfPrefix: "x",
    }));
    track.start({ push: (_kind, data) => pushed.push(data as NetworkEntry), logger });
    await expect(fetch("http://api.test/down")).rejects.toThrow("Failed to fetch");
    expect(pushed[0]).toMatchObject({ status: null, error: "Failed to fetch" });
    track.stop();
  });

  it("puts fetch back on stop", () => {
    const { track, inner } = start();
    track.stop();
    expect(window.fetch).toBe(inner);
  });
});
