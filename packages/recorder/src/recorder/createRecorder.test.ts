import { gunzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  DEFAULT_RECORDING_POLICY,
  RECORDING_HEADER,
  decodeRecordingHeader,
  type RecordingSegmentHeader,
} from "@capuchoo/core";
import { createRecorder } from "./createRecorder.js";

interface Upload {
  header: RecordingSegmentHeader;
  lines: Array<{ k: string; d: Record<string, unknown> }>;
}

let uploads: Upload[];
let policyRequests: number;
let originalFetch: typeof fetch;

function policy(overrides: Record<string, unknown> = {}) {
  return {
    ...DEFAULT_RECORDING_POLICY,
    tracks: { ...DEFAULT_RECORDING_POLICY.tracks, replay: false, perf: false },
    version: `v${policyRequests}`,
    liveUntil: null,
    sampled: true,
    ...overrides,
  };
}

function serve(policyBody: () => unknown) {
  window.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/api/recording/policy")) {
      policyRequests++;
      return new Response(JSON.stringify(policyBody()), {
        headers: { "content-type": "application/json" },
      });
    }
    if (url.endsWith("/api/recording/segments")) {
      const headers = new Headers(init!.headers);
      const text = gunzipSync(Buffer.from(init!.body as Uint8Array)).toString("utf8");
      uploads.push({
        header: decodeRecordingHeader(headers.get(RECORDING_HEADER)) as RecordingSegmentHeader,
        lines: text
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line) as Upload["lines"][number]),
      });
      return new Response(null, { status: 201 });
    }
    return new Response("{}", { headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

const identity = async () => ({
  apiUrl: "http://server.test/api",
  appId: "com.acme.app",
  deviceId: "d1",
  platform: "android" as const,
  versionName: "2.0.0",
  versionCode: 20,
  channel: "prod",
});

beforeEach(() => {
  uploads = [];
  policyRequests = 0;
  originalFetch = window.fetch;
  localStorage.clear();
});
afterEach(() => {
  window.fetch = originalFetch;
});

describe("createRecorder", () => {
  it("stays off by default and records nothing", async () => {
    serve(() => ({ policy: policy(), known_assets: [] }));
    const recorder = createRecorder({ identity, shake: false });
    await recorder.start();
    console.log("ignored");
    expect(recorder.status.mode).toBe("off");
    await recorder.stop();
    expect(uploads).toHaveLength(0);
  });

  it("records a session, uploads gzip segments with metadata, and ends it on stop", async () => {
    serve(() => ({ policy: policy({ mode: "session", flushMs: 1000 }), known_assets: [] }));
    const recorder = createRecorder({ identity, shake: false });
    await recorder.start();
    expect(recorder.status.mode).toBe("session");

    console.warn("stock low", { sku: "A1" });
    recorder.telemetry.event("order.created", { lines: 3 });
    recorder.mark("checkout", { step: 2 });
    await recorder.stop();

    await vi.waitFor(() =>
      expect(uploads.some((upload) => upload.header.segment.final)).toBe(true),
    );
    const header = uploads[0]!.header;
    expect(header.session).toMatchObject({
      appId: "com.acme.app",
      deviceId: "d1",
      versionName: "2.0.0",
      mode: "session",
      start: "policy",
    });
    const kinds = uploads.flatMap((upload) => upload.lines.map((line) => line.k));
    expect(kinds).toEqual(expect.arrayContaining(["console", "telemetry", "marker"]));
    const warn = uploads.flatMap((upload) => upload.lines).find((line) => line.k === "console");
    expect(warn!.d).toMatchObject({ level: "warn", text: 'stock low {sku: "A1"}' });
  });

  it("raises a buffering device to a session on report, with the note", async () => {
    serve(() => ({ policy: policy({ mode: "buffer" }), known_assets: [] }));
    const recorder = createRecorder({ identity, shake: false });
    await recorder.start();
    expect(recorder.status.mode).toBe("buffer");
    console.info("before the problem");

    recorder.report({ note: "the order will not send" });
    expect(recorder.status.mode).toBe("session");

    await vi.waitFor(() => expect(uploads.length).toBeGreaterThan(0));
    expect(uploads[0]!.header.session).toMatchObject({
      start: "manual",
      note: "the order will not send",
    });
    const texts = uploads.flatMap((upload) => upload.lines).map((line) => line.d.text);
    expect(texts).toContain("before the problem");
    await recorder.stop();
    await vi.waitFor(() =>
      expect(uploads.some((upload) => upload.header.segment.final)).toBe(true),
    );
  });

  it("keeps an error in the background in the buffer instead of raising a session", async () => {
    serve(() => ({ policy: policy({ mode: "buffer" }), known_assets: [] }));
    const recorder = createRecorder({ identity, shake: false });
    await recorder.start();
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    console.error(new Error("offline while locked"));
    expect(recorder.status.mode).toBe("buffer");

    visibility.mockReturnValue("visible");
    console.error(new Error("broke on screen"));
    expect(recorder.status.mode).toBe("session");
    visibility.mockRestore();
    await recorder.stop();
  });

  it("ignores a trigger the policy does not allow", async () => {
    serve(() => ({ policy: policy({ mode: "buffer", triggers: ["error"] }), known_assets: [] }));
    const recorder = createRecorder({ identity, shake: false });
    await recorder.start();
    recorder.trigger("shake");
    expect(recorder.status.mode).toBe("buffer");
    await recorder.stop();
  });

  it("refuses to start without an identity", async () => {
    const recorder = createRecorder({
      identity: async () => ({ ...(await identity()), deviceId: "" }),
      shake: false,
      logger: { warn() {}, error() {} },
    });
    await recorder.start();
    expect(recorder.status.lastError).toMatch(/missing/);
  });
});
