import type { RecordedEvent, RecordingMode, RecordingSessionMeta } from "@capuchoo/core";
import { createAssetUploader } from "./assetUploader.js";
import type { Compressor } from "./compress.js";
import { segmentsToEvict } from "./eviction.js";
import type {
  PipelineCommand,
  PipelineReport,
  PipelineSettings,
  PipelineStatus,
} from "./protocol.js";
import { SegmentBuilder } from "./segmentBuilder.js";
import type { SegmentStore, StoredSegment, StoredSession } from "./segmentStore.js";
import type { Transport } from "./transport.js";
import { createUploadQueue } from "./uploadQueue.js";

const BUFFER_SEGMENT_MS = 10_000;
const STATUS_INTERVAL_MS = 2000;
const RECOVERED_NOTE = "Recovered after the app stopped with errors in its buffer";

export interface PipelineDeps {
  store: SegmentStore;
  transport: Transport;
  compress: Compressor;
  now: () => number;
  report: (report: PipelineReport) => void;
}

interface ActiveSession {
  stored: StoredSession;
  mode: RecordingMode;
  nextSeq: number;
}

const uploads = (mode: RecordingMode) => mode === "session" || mode === "live";

/**
 * Turns the event stream into durable gzip segments and gets them to the server. Everything here
 * runs in the recorder worker: serialization, compression, file writes and uploads never touch the
 * thread the app renders on.
 */
export function createPipeline(deps: PipelineDeps) {
  let settings: PipelineSettings | null = null;
  let current: ActiveSession | null = null;
  let builder = new SegmentBuilder();
  let online = true;
  let wifi: boolean | null = null;
  let recovered = false;
  let work: Promise<void> = Promise.resolve();
  let tick: ReturnType<typeof setInterval> | null = null;
  let statusTimer: ReturnType<typeof setTimeout> | null = null;
  const waiting = new Map<string, StoredSession>();
  const status: PipelineStatus = {
    backend: deps.store.backend,
    queued: 0,
    uploadedSegments: 0,
    uploadedBytes: 0,
    droppedSegments: 0,
    lastError: null,
  };

  const warn = (message: string) => {
    status.lastError = message;
    deps.report({ type: "log", level: "warn", message });
  };

  function serial(task: () => Promise<void>): void {
    work = work.then(task).catch((error: unknown) => warn(`recorder pipeline: ${String(error)}`));
  }

  function reportStatus(): void {
    if (statusTimer !== null) return;
    statusTimer = setTimeout(() => {
      statusTimer = null;
      status.queued = queue.size;
      deps.report({ type: "status", status: { ...status } });
    }, STATUS_INTERVAL_MS);
  }

  const queue = createUploadQueue({
    store: deps.store,
    transport: deps.transport,
    session: (sessionId) =>
      current?.stored.meta.sessionId === sessionId ? current.stored : waiting.get(sessionId),
    allowed: () => online && !(settings?.wifiOnly && wifi === false),
    onSettled: (session, segment, outcome) => {
      if (outcome === "ok") {
        status.uploadedSegments++;
        status.uploadedBytes += segment.stored;
      } else status.droppedSegments++;
      serial(() => settle(session, segment));
      reportStatus();
    },
  });

  const assets = createAssetUploader(deps.transport, warn);

  async function settle(session: StoredSession, segment: StoredSegment): Promise<void> {
    session.segments = session.segments.filter((candidate) => candidate.seq !== segment.seq);
    await deps.store.deleteSegment(session.meta.sessionId, segment.seq);
    const isCurrent = current?.stored === session;
    if (!isCurrent && session.segments.length === 0) {
      waiting.delete(session.meta.sessionId);
      await deps.store.deleteSession(session.meta.sessionId);
      return;
    }
    await deps.store.saveSession(session);
  }

  function flushInterval(mode: RecordingMode): number {
    if (!settings) return BUFFER_SEGMENT_MS;
    if (mode === "live") return settings.liveFlushMs;
    if (mode === "session") return settings.flushMs;
    return BUFFER_SEGMENT_MS;
  }

  function restartTick(): void {
    if (tick !== null) clearInterval(tick);
    tick = null;
    if (!current) return;
    const interval = flushInterval(current.mode);
    tick = setInterval(
      () => {
        if (current && !builder.empty && deps.now() - builder.openedAt >= interval)
          closeSegment(false);
      },
      Math.min(1000, interval),
    );
  }

  function closeSegment(final: boolean): void {
    const session = current;
    if (!session) return;
    const closed = builder.close();
    if (!closed && !final) return;
    const now = deps.now();
    const segment: StoredSegment = {
      sessionId: session.stored.meta.sessionId,
      seq: session.nextSeq++,
      startedAt: closed?.startedAt ?? now,
      endedAt: closed?.endedAt ?? now,
      events: closed?.events ?? 0,
      bytes: closed?.bytes ?? 0,
      fullSnapshot: closed?.fullSnapshot ?? false,
      errors: closed?.errors ?? 0,
      ...(closed?.issues.length ? { issues: closed.issues } : {}),
      final,
      stored: 0,
    };
    const text = closed?.text ?? "";

    serial(async () => {
      const bytes = await deps.compress(text);
      segment.stored = bytes.length;
      await deps.store.writeSegment(segment.sessionId, segment.seq, bytes);
      session.stored.segments.push(segment);
      if (session.stored.promoted) {
        await deps.store.saveSession(session.stored);
        queue.enqueue(segment.sessionId, segment.seq);
        return;
      }
      await evict(session.stored);
    });
  }

  async function evict(session: StoredSession): Promise<void> {
    if (!settings) return;
    const doomed = new Set(
      segmentsToEvict(
        session.segments,
        { maxMs: settings.bufferMaxMs, maxBytes: settings.bufferMaxBytes },
        deps.now(),
        (segment) => (segment as StoredSegment).stored,
      ),
    );
    if (doomed.size > 0) {
      session.segments = session.segments.filter((segment) => !doomed.has(segment.seq));
      for (const seq of doomed) await deps.store.deleteSegment(session.meta.sessionId, seq);
    }
    await deps.store.saveSession(session);
  }

  function promote(session: ActiveSession, meta: RecordingSessionMeta): void {
    serial(async () => {
      const first = session.stored.segments[0];
      session.stored.meta = {
        ...meta,
        startedAt: Math.min(meta.startedAt, first?.startedAt ?? meta.startedAt),
      };
      if (session.stored.promoted) {
        await deps.store.saveSession(session.stored);
        return;
      }
      session.stored.promoted = true;
      await deps.store.saveSession(session.stored);
      for (const segment of session.stored.segments) queue.enqueue(segment.sessionId, segment.seq);
    });
  }

  function end(): void {
    const session = current;
    if (!session) return;
    const { stored } = session;
    if (stored.promoted) {
      waiting.set(stored.meta.sessionId, stored);
      closeSegment(true);
    } else builder.close();
    current = null;
    restartTick();
    if (!stored.promoted) serial(() => deps.store.deleteSession(stored.meta.sessionId));
  }

  async function recover(): Promise<void> {
    for (const stored of await deps.store.listSessions()) {
      const id = stored.meta.sessionId;
      if (!stored.promoted && !stored.segments.some((segment) => segment.errors > 0)) {
        await deps.store.deleteSession(id);
        continue;
      }
      if (!stored.promoted) {
        stored.promoted = true;
        stored.meta = { ...stored.meta, start: "error", note: stored.meta.note ?? RECOVERED_NOTE };
      }
      if (!stored.segments.some((segment) => segment.final)) {
        const seq = Math.max(-1, ...stored.segments.map((segment) => segment.seq)) + 1;
        const bytes = await deps.compress("");
        await deps.store.writeSegment(id, seq, bytes);
        const at = Math.max(
          stored.meta.startedAt,
          ...stored.segments.map((segment) => segment.endedAt),
        );
        stored.segments.push({
          sessionId: id,
          seq,
          startedAt: at,
          endedAt: at,
          events: 0,
          bytes: 0,
          fullSnapshot: false,
          errors: 0,
          final: true,
          stored: bytes.length,
        });
      }
      await deps.store.saveSession(stored);
      waiting.set(id, stored);
      for (const segment of stored.segments.sort((a, b) => a.seq - b.seq)) {
        queue.enqueue(id, segment.seq);
      }
    }
  }

  function addEvents(events: readonly RecordedEvent[]): void {
    if (!current) return;
    const now = deps.now();
    for (const event of events) {
      if (builder.breaksBefore(event)) closeSegment(false);
      builder.add(event, now);
      if (builder.full) closeSegment(false);
    }
  }

  return {
    handle(command: PipelineCommand): void {
      switch (command.type) {
        case "configure":
          settings = command.settings;
          restartTick();
          if (!recovered) {
            recovered = true;
            serial(recover);
          }
          queue.resume();
          return;
        case "begin":
          end();
          current = {
            stored: { meta: command.session, promoted: uploads(command.mode), segments: [] },
            mode: command.mode,
            nextSeq: 0,
          };
          builder = new SegmentBuilder();
          restartTick();
          {
            const stored = current.stored;
            serial(() => deps.store.saveSession(stored));
          }
          return;
        case "mode":
          if (!current) return;
          current.mode = command.mode;
          if (uploads(command.mode)) promote(current, command.session);
          else {
            const stored = current.stored;
            stored.meta = command.session;
            serial(() => deps.store.saveSession(stored));
          }
          restartTick();
          return;
        case "events":
          addEvents(command.events);
          return;
        case "flush":
          closeSegment(false);
          return;
        case "end":
          end();
          return;
        case "network":
          online = command.online;
          wifi = command.wifi;
          queue.resume();
          return;
        case "assets":
          assets.enqueue(command.request);
          return;
      }
    },

    /** Resolves once every queued file operation has finished; for tests and orderly shutdown. */
    settled(): Promise<void> {
      return work;
    },

    dispose(): void {
      if (tick !== null) clearInterval(tick);
      if (statusTimer !== null) clearTimeout(statusTimer);
      tick = null;
      statusTimer = null;
    },
  };
}

export type Pipeline = ReturnType<typeof createPipeline>;
