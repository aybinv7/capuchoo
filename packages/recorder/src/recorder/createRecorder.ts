import type {
  RecordingMode,
  RecordingSessionMeta,
  RecordingStart,
  RecordingTrigger,
  ResolvedRecordingPolicy,
} from "@capuchoo/core";
import { createInlineClient, createWorkerClient } from "../pipeline/clients.js";
import type { PipelineClient, PipelineStatus } from "../pipeline/protocol.js";
import { createPolicyClient, type PolicyAnswer } from "../policy/policyClient.js";
import { createConsoleTrack } from "../tracks/console.js";
import { createDatabaseTrack } from "../tracks/database.js";
import { watchNavigation } from "../tracks/navigation.js";
import { createNetworkTrack } from "../tracks/network.js";
import { createPerfTrack } from "../tracks/perf.js";
import { createReplayTrack } from "../tracks/replay.js";
import { createTelemetry } from "../tracks/telemetry.js";
import { watchShake } from "../triggers/shake.js";
import { discoverAssetUrls } from "./assets.js";
import { EventCollector } from "./collector.js";
import { watchLifecycle } from "./lifecycle.js";
import {
  effectiveMode,
  mergeEscalation,
  sessionStart,
  transition,
  type Escalation,
} from "./mode.js";
import { createSessionId, normaliseEndpoint, sessionMeta } from "./session.js";
import { TrackSet } from "./trackSet.js";
import type {
  Recorder,
  RecorderIdentity,
  RecorderLogger,
  RecorderOptions,
  RecorderStatus,
  Track,
  TrackContext,
} from "./types.js";

const originalWarn = console.warn.bind(console);
const originalError = console.error.bind(console);

const defaultLogger: RecorderLogger = {
  warn: (message, detail) => originalWarn(`[capuchoo-recorder] ${message}`, detail ?? ""),
  error: (message, detail) => originalError(`[capuchoo-recorder] ${message}`, detail ?? ""),
};

const ASSET_DELAY_MS = 3000;
const LIVE_HEARTBEAT_MS = 5000;

interface OpenSession {
  id: string;
  startedAt: number;
  start: RecordingStart;
  note: string | null;
}

export function createRecorder(options: RecorderOptions): Recorder {
  const logger = options.logger ?? defaultLogger;
  let identity: RecorderIdentity | null = null;
  let endpoint = "";
  let client: PipelineClient | null = null;
  let policyClient: ReturnType<typeof createPolicyClient> | null = null;
  let answer: PolicyAnswer | null = null;
  let mode: RecordingMode = "off";
  let escalation: Escalation | null = null;
  let session: OpenSession | null = null;
  let pipelineStatus: PipelineStatus | null = null;
  let lastError: string | null = null;
  let started = false;
  let escalationTimer: ReturnType<typeof setTimeout> | null = null;
  let sessionTimer: ReturnType<typeof setTimeout> | null = null;
  let assetTimer: ReturnType<typeof setTimeout> | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  const cleanups: Array<() => void> = [];
  let stopNavigation: (() => void) | null = null;
  const listeners = new Set<(status: RecorderStatus) => void>();

  const collector = new EventCollector((events) => client?.send({ type: "events", events }));
  const context: TrackContext = {
    push(kind, data, time) {
      if (mode !== "off") collector.push(kind, data, time);
    },
    logger,
  };

  const policy = (): ResolvedRecordingPolicy | null => answer?.policy ?? null;

  const replay = createReplayTrack(options.replay);
  const telemetryTrack: Track = { name: "telemetry", start() {}, stop() {} };
  const tracks = new TrackSet(
    [
      replay,
      createConsoleTrack(() => trigger("error")),
      createNetworkTrack(options.network ?? {}, () => ({
        bodies: policy()?.network.bodies ?? false,
        maxBodyBytes: policy()?.network.maxBodyBytes ?? 0,
        selfPrefix: `${endpoint}/api/recording`,
      })),
      createPerfTrack(),
      createDatabaseTrack(options.databases ?? [], () => policy()?.database.tables ?? "all"),
      telemetryTrack,
    ],
    context,
  );

  const telemetry = createTelemetry(() =>
    mode !== "off" && tracks.isRunning("telemetry")
      ? (data, time) => collector.push("telemetry", data, time)
      : null,
  );

  function status(): RecorderStatus {
    return {
      mode,
      sessionId: session?.id ?? null,
      policyVersion: policy()?.version ?? null,
      pipeline: pipelineStatus,
      lastError,
    };
  }

  function notify(): void {
    const snapshot = status();
    for (const listener of listeners) {
      try {
        listener(snapshot);
      } catch {
        continue;
      }
    }
  }

  function fail(message: string): void {
    lastError = message;
    logger.warn(message);
    notify();
  }

  function currentMeta(): RecordingSessionMeta | null {
    if (!identity || !session) return null;
    return sessionMeta({
      sessionId: session.id,
      identity,
      mode,
      start: session.start,
      startedAt: session.startedAt,
      note: session.note,
    });
  }

  function scheduleAssets(): void {
    if (assetTimer !== null || !identity || !tracks.isRunning("replay")) return;
    assetTimer = setTimeout(() => {
      assetTimer = null;
      if (!identity || mode === "off") return;
      client?.send({
        type: "assets",
        request: {
          appId: identity.appId,
          versionName: identity.versionName,
          urls: discoverAssetUrls(),
          known: answer?.knownAssets ?? [],
        },
      });
    }, ASSET_DELAY_MS);
  }

  /** A live viewer needs to tell an idle device from a gone one; a beat every few seconds does. */
  function syncHeartbeat(): void {
    if (mode === "live" && heartbeat === null) {
      heartbeat = setInterval(() => context.push("meta", { kind: "heartbeat" }), LIVE_HEARTBEAT_MS);
    } else if (mode !== "live" && heartbeat !== null) {
      clearInterval(heartbeat);
      heartbeat = null;
    }
  }

  function armSessionLimit(): void {
    if (sessionTimer !== null) clearTimeout(sessionTimer);
    sessionTimer = null;
    const current = policy();
    if (!current || !session || (mode !== "session" && mode !== "live")) return;
    const remaining = session.startedAt + current.maxSessionMs - Date.now();
    sessionTimer = setTimeout(rotate, Math.max(1000, remaining));
  }

  function openSession(start: RecordingStart, note: string | null = null): void {
    session = { id: createSessionId(), startedAt: Date.now(), start, note };
    const meta = currentMeta();
    if (meta) client?.send({ type: "begin", mode, session: meta });
  }

  function rotate(): void {
    if (!session || mode === "off") return;
    collector.flush();
    client?.send({ type: "end" });
    openSession("policy");
    replay.checkout();
    armSessionLimit();
    notify();
  }

  function apply(next: RecordingMode, start: RecordingStart): void {
    const current = policy();
    const step = transition(mode, next);
    switch (step.kind) {
      case "none":
        if (mode !== "off" && current) tracks.apply(current.tracks);
        break;
      case "begin":
        mode = next;
        openSession(start);
        if (current) tracks.apply(current.tracks);
        stopNavigation = watchNavigation((data) => {
          context.push("marker", data);
          scheduleAssets();
        });
        scheduleAssets();
        break;
      case "end":
        tracks.stopAll();
        stopNavigation?.();
        stopNavigation = null;
        collector.flush();
        client?.send({ type: "end" });
        mode = "off";
        session = null;
        break;
      case "promote":
        collector.flush();
        mode = next;
        if (session) session.start = start;
        {
          const meta = currentMeta();
          if (meta) client?.send({ type: "mode", mode, session: meta });
        }
        break;
      case "rotate":
        collector.flush();
        client?.send({ type: "end" });
        mode = next;
        openSession("policy");
        replay.checkout();
        break;
      case "retune":
        mode = next;
        {
          const meta = currentMeta();
          if (meta) client?.send({ type: "mode", mode, session: meta });
        }
        break;
    }
    armSessionLimit();
    syncHeartbeat();
  }

  function recompute(): void {
    const now = Date.now();
    apply(effectiveMode(policy(), escalation, now), sessionStart(policy(), escalation, now));
    if (escalationTimer !== null) clearTimeout(escalationTimer);
    escalationTimer = null;
    if (escalation && escalation.until > now) {
      escalationTimer = setTimeout(recompute, escalation.until - now + 50);
    } else escalation = null;
    notify();
  }

  function configure(current: ResolvedRecordingPolicy): void {
    client?.send({
      type: "configure",
      settings: {
        endpoint,
        flushMs: current.flushMs,
        liveFlushMs: current.liveFlushMs,
        bufferMaxMs: current.buffer.maxMs,
        bufferMaxBytes: current.buffer.maxBytes,
        wifiOnly: current.wifiOnly,
      },
    });
  }

  function onPolicy(next: PolicyAnswer): void {
    answer = next;
    configure(next.policy);
    recompute();
    scheduleAssets();
  }

  function trigger(kind: RecordingTrigger, triggerOptions: { note?: string } = {}): void {
    const current = policy();
    if (!started || !current || !current.triggers.includes(kind)) return;
    const now = Date.now();
    escalation = mergeEscalation(
      escalation,
      { mode: "session", until: now + current.postRollMs, start: kind },
      now,
    );
    if (triggerOptions.note && session) session.note = triggerOptions.note;
    context.push("marker", { kind: "trigger", trigger: kind, note: triggerOptions.note ?? null });
    recompute();
  }

  function startClient(): PipelineClient {
    if (options.worker) {
      try {
        return createWorkerClient(options.worker());
      } catch (error) {
        logger.warn("recorder worker could not start; recording on the main thread", error);
      }
    }
    return createInlineClient();
  }

  return {
    async start() {
      if (started) return;
      try {
        identity = await options.identity();
      } catch (error) {
        fail(`recorder identity unavailable: ${String(error)}`);
        return;
      }
      if (!identity.apiUrl || !identity.appId || !identity.deviceId) {
        fail("recorder identity is missing apiUrl, appId or deviceId; recording stays off");
        return;
      }
      started = true;
      endpoint = normaliseEndpoint(identity.apiUrl);
      client = startClient();
      cleanups.push(
        client.onReport((report) => {
          if (report.type === "status") {
            pipelineStatus = report.status;
            notify();
          } else logger.warn(report.message);
        }),
      );
      cleanups.push(
        watchLifecycle({
          onHidden: () => {
            collector.flush();
            client?.send({ type: "flush" });
          },
          onNetwork: (online, wifi) => client?.send({ type: "network", online, wifi }),
        }),
      );
      if (options.shake !== false) {
        cleanups.push(
          watchShake(
            () => {
              trigger("shake");
              options.onShake?.();
            },
            typeof options.shake === "object" ? options.shake : {},
          ),
        );
      }

      const known = identity;
      policyClient = createPolicyClient({
        endpoint,
        request: () => ({
          appId: known.appId,
          deviceId: known.deviceId,
          platform: known.platform,
          versionName: known.versionName,
          versionCode: known.versionCode,
          channel: known.channel,
        }),
        onPolicy,
        onError: (message) => {
          lastError = message;
          notify();
        },
      });
      if (policyClient.cached) onPolicy(policyClient.cached);
      await policyClient.start();
    },

    async stop() {
      if (!started) return;
      policyClient?.stop();
      escalation = null;
      apply("off", "policy");
      for (const timer of [escalationTimer, sessionTimer, assetTimer]) {
        if (timer !== null) clearTimeout(timer);
      }
      escalationTimer = sessionTimer = assetTimer = null;
      for (const cleanup of cleanups.splice(0)) cleanup();
      client?.terminate();
      client = null;
      started = false;
      notify();
    },

    trigger,

    escalate(target, escalateOptions = {}) {
      const current = policy();
      if (!started || !current || !current.triggers.includes("app")) return;
      const now = Date.now();
      escalation = mergeEscalation(
        escalation,
        {
          mode: target,
          until: now + (escalateOptions.durationMs ?? current.postRollMs),
          start: "app",
        },
        now,
      );
      context.push("marker", {
        kind: "escalate",
        mode: target,
        reason: escalateOptions.reason ?? null,
      });
      recompute();
    },

    report(reportOptions = {}) {
      const note = reportOptions.note?.trim() || null;
      if (session && note) session.note = note;
      trigger("manual", note ? { note } : {});
      if (mode === "session" || mode === "live") {
        const meta = currentMeta();
        if (meta) client?.send({ type: "mode", mode, session: meta });
        collector.flush();
        client?.send({ type: "flush" });
      }
    },

    mark(name, data) {
      context.push("marker", { kind: name, ...data });
    },

    refreshPolicy() {
      return policyClient?.refresh() ?? Promise.resolve();
    },

    telemetry,

    get status() {
      return status();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
