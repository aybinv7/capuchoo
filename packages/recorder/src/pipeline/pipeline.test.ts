import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { RecordedEvent, RecordingSegmentMeta, RecordingSessionMeta } from "@capuchoo/core";
import { createPipeline } from "./pipeline.js";
import type { PipelineSettings } from "./protocol.js";
import { createMemoryStore, type SegmentStore } from "./segmentStore.js";
import type { SendOutcome, Transport } from "./transport.js";

const SESSION = "0190a8d2-7c1e-7b3a-9f00-1234567890ab";

const settings: PipelineSettings = {
  endpoint: "http://server.test",
  flushMs: 5000,
  liveFlushMs: 1000,
  bufferMaxMs: 60_000,
  bufferMaxBytes: 10_000_000,
  wifiOnly: false,
};

function meta(overrides: Partial<RecordingSessionMeta> = {}): RecordingSessionMeta {
  return {
    sessionId: SESSION,
    appId: "com.acme.app",
    deviceId: "d1",
    platform: "android",
    versionName: "1.0.0",
    versionCode: 1,
    channel: "prod",
    start: "policy",
    mode: "buffer",
    startedAt: Date.now(),
    recorder: "test",
    device: { model: null, manufacturer: null, osVersion: null, webview: null, screen: null },
    note: null,
    ...overrides,
  };
}

const checkout = (t: number): RecordedEvent[] => [
  { k: "replay", t, d: { type: 4 } },
  { k: "replay", t: t + 1, d: { type: 2 } },
];

interface Sent {
  session: RecordingSessionMeta;
  segment: RecordingSegmentMeta;
  text: string;
}

function setup(outcomes: SendOutcome[] = [], store: SegmentStore = createMemoryStore()) {
  const sent: Sent[] = [];
  const transport: Transport = {
    sendSegment: vi.fn(async (session, segment, bytes) => {
      sent.push({ session: { ...session }, segment, text: new TextDecoder().decode(bytes) });
      return outcomes.shift() ?? "ok";
    }),
    sendAsset: vi.fn(async () => "ok" as const),
  };
  const pipeline = createPipeline({
    store,
    transport,
    compress: async (text) => new TextEncoder().encode(text),
    now: () => Date.now(),
    report: () => undefined,
  });
  return { pipeline, sent, transport, store };
}

async function drain(pipeline: ReturnType<typeof setup>["pipeline"]) {
  for (let round = 0; round < 5; round++) {
    await pipeline.settled();
    await vi.advanceTimersByTimeAsync(0);
  }
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("pipeline", () => {
  it("buffers without uploading, then uploads the buffer in order when promoted", async () => {
    const { pipeline, sent } = setup();
    pipeline.handle({ type: "configure", settings });
    const t0 = Date.now();
    pipeline.handle({ type: "begin", mode: "buffer", session: meta() });
    pipeline.handle({
      type: "events",
      events: [...checkout(t0), { k: "console", t: t0 + 500, d: { level: "log" } }],
    });
    pipeline.handle({ type: "events", events: [...checkout(t0 + 1000)] });
    pipeline.handle({ type: "flush" });
    await drain(pipeline);
    expect(sent).toHaveLength(0);

    pipeline.handle({
      type: "mode",
      mode: "session",
      session: meta({ mode: "session", start: "shake", note: "help" }),
    });
    await drain(pipeline);

    expect(sent.map((item) => item.segment.seq)).toEqual([0, 1]);
    expect(sent[0]!.segment).toMatchObject({ fullSnapshot: true, events: 3 });
    expect(sent[0]!.session).toMatchObject({ start: "shake", note: "help", startedAt: t0 });
  });

  it("closes a segment every flush interval in session mode and marks the last one final", async () => {
    const { pipeline, sent } = setup();
    pipeline.handle({ type: "configure", settings });
    pipeline.handle({ type: "begin", mode: "session", session: meta({ mode: "session" }) });
    pipeline.handle({ type: "events", events: checkout(Date.now()) });
    await vi.advanceTimersByTimeAsync(6000);
    await drain(pipeline);
    expect(sent).toHaveLength(1);

    pipeline.handle({
      type: "events",
      events: [{ k: "console", t: Date.now(), d: { level: "error" } }],
    });
    pipeline.handle({ type: "end" });
    await drain(pipeline);
    expect(sent.map((item) => item.segment)).toMatchObject([
      { seq: 0, final: false },
      { seq: 1, final: true, errors: 1 },
    ]);
  });

  it("retries a transient failure with backoff and drops a refusal", async () => {
    const { pipeline, sent } = setup(["retry", "ok", "drop"]);
    pipeline.handle({ type: "configure", settings });
    pipeline.handle({ type: "begin", mode: "session", session: meta({ mode: "session" }) });
    pipeline.handle({ type: "events", events: checkout(Date.now()) });
    pipeline.handle({ type: "flush" });
    await drain(pipeline);
    expect(sent).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(2000);
    await drain(pipeline);
    expect(sent.map((item) => item.segment.seq)).toEqual([0, 0]);

    pipeline.handle({ type: "events", events: checkout(Date.now()) });
    pipeline.handle({ type: "flush" });
    await drain(pipeline);
    expect(sent.map((item) => item.segment.seq)).toEqual([0, 0, 1]);
  });

  it("holds uploads while offline and sends them when the network returns", async () => {
    const { pipeline, sent } = setup();
    pipeline.handle({ type: "configure", settings });
    pipeline.handle({ type: "network", online: false, wifi: null });
    pipeline.handle({ type: "begin", mode: "session", session: meta({ mode: "session" }) });
    pipeline.handle({ type: "events", events: checkout(Date.now()) });
    pipeline.handle({ type: "flush" });
    await drain(pipeline);
    expect(sent).toHaveLength(0);

    pipeline.handle({ type: "network", online: true, wifi: null });
    await drain(pipeline);
    expect(sent).toHaveLength(1);
  });

  it("waits for wifi when the policy says so", async () => {
    const { pipeline, sent } = setup();
    pipeline.handle({ type: "configure", settings: { ...settings, wifiOnly: true } });
    pipeline.handle({ type: "network", online: true, wifi: false });
    pipeline.handle({ type: "begin", mode: "session", session: meta({ mode: "session" }) });
    pipeline.handle({ type: "events", events: checkout(Date.now()) });
    pipeline.handle({ type: "flush" });
    await drain(pipeline);
    expect(sent).toHaveLength(0);
    pipeline.handle({ type: "network", online: true, wifi: true });
    await drain(pipeline);
    expect(sent).toHaveLength(1);
  });

  it("discards an unpromoted buffer when the session ends", async () => {
    const { pipeline, sent, store } = setup();
    pipeline.handle({ type: "configure", settings });
    pipeline.handle({ type: "begin", mode: "buffer", session: meta() });
    pipeline.handle({ type: "events", events: checkout(Date.now()) });
    pipeline.handle({ type: "end" });
    await drain(pipeline);
    expect(sent).toHaveLength(0);
    expect(await store.listSessions()).toEqual([]);
  });

  it("recovers a buffer that held errors after a crash, and discards a clean one", async () => {
    const store = createMemoryStore();
    const crashed = setup([], store);
    crashed.pipeline.handle({ type: "configure", settings });
    crashed.pipeline.handle({ type: "begin", mode: "buffer", session: meta() });
    crashed.pipeline.handle({
      type: "events",
      events: [...checkout(Date.now()), { k: "console", t: Date.now(), d: { level: "error" } }],
    });
    crashed.pipeline.handle({ type: "flush" });
    await drain(crashed.pipeline);

    const clean = "0190a8d2-7c1e-7b3a-9f00-00000000c1ea";
    await store.saveSession({ meta: meta({ sessionId: clean }), promoted: false, segments: [] });

    const restarted = setup([], store);
    restarted.pipeline.handle({ type: "configure", settings });
    await drain(restarted.pipeline);

    expect(restarted.sent.map((item) => item.segment)).toMatchObject([
      { seq: 0, errors: 1 },
      { seq: 1, final: true, events: 0 },
    ]);
    expect(restarted.sent[0]!.session).toMatchObject({ start: "error" });
    expect(restarted.sent[0]!.session.note).toMatch(/Recovered/);
    expect((await store.listSessions()).map((session) => session.meta.sessionId)).toEqual([]);
  });

  it("starts a new segment at the size limit", async () => {
    const { pipeline, sent } = setup();
    pipeline.handle({ type: "configure", settings });
    pipeline.handle({ type: "begin", mode: "session", session: meta({ mode: "session" }) });
    const big = "x".repeat(300 * 1024);
    pipeline.handle({
      type: "events",
      events: [
        { k: "console", t: 1, d: { text: big } },
        { k: "console", t: 2, d: { text: big } },
        { k: "console", t: 3, d: { text: "small" } },
      ],
    });
    pipeline.handle({ type: "flush" });
    await drain(pipeline);
    expect(sent.map((item) => item.segment.events)).toEqual([2, 1]);
  });
});
