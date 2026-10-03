import { describeArgs, stackOf } from "./describe.js";

export interface TelemetrySpan {
  end(data?: Record<string, unknown>): void;
}

/** Structurally the adapter `@sig/telemetry` fans out to, so a recorder can be one of its adapters. */
export interface TelemetryAdapter {
  event(event: {
    name: string;
    timestamp: number;
    operationId?: string;
    durationMs?: number;
    data?: Record<string, unknown>;
  }): void;
}

export interface RecorderTelemetry {
  event(name: string, data?: Record<string, unknown>): void;
  span(name: string, data?: Record<string, unknown>): TelemetrySpan;
  measure(name: string, value: number, unit?: string): void;
  error(error: unknown, data?: Record<string, unknown>): void;
  readonly adapter: TelemetryAdapter;
}

export type TelemetrySink = (data: Record<string, unknown>, time?: number) => void;

/**
 * The app's own signals - business events, spans around sync or checkout, measurements - on the same
 * timeline as the replay. Calls are dropped while the telemetry track is off.
 */
export function createTelemetry(sink: () => TelemetrySink | null): RecorderTelemetry {
  const push = (data: Record<string, unknown>, time?: number) => sink()?.(data, time);

  return {
    event(name, data) {
      push({ kind: "event", name, data: data ?? null });
    },
    span(name, data) {
      const startedAt = Date.now();
      const began = performance.now();
      push({ kind: "span-start", name, data: data ?? null }, startedAt);
      let ended = false;
      return {
        end(endData) {
          if (ended) return;
          ended = true;
          push({
            kind: "span",
            name,
            startedAt,
            duration: Math.round(performance.now() - began),
            data: endData ?? data ?? null,
          });
        },
      };
    },
    measure(name, value, unit) {
      if (!Number.isFinite(value)) return;
      push({ kind: "measure", name, value, unit: unit ?? null });
    },
    error(error, data) {
      push({
        kind: "error",
        message: describeArgs([error]),
        stack: stackOf(error),
        data: data ?? null,
      });
    },
    adapter: {
      event(event) {
        push(
          {
            kind: event.durationMs === undefined ? "event" : "span",
            name: event.name,
            operationId: event.operationId ?? null,
            duration: event.durationMs ?? null,
            data: event.data ?? null,
          },
          event.timestamp,
        );
      },
    },
  };
}
