import type { RecordedEvent } from "@capuchoo/core";

const CHUNK = 0x8000;

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK));
  }
  return btoa(binary);
}

function replacer(_key: string, value: unknown): unknown {
  if (value instanceof Uint8Array) return { $b64: toBase64(value) };
  if (typeof value === "bigint") return value.toString();
  return value;
}

/** One NDJSON line; binary becomes `{ $b64 }`, a bigint its decimal text. Never throws. */
export function serializeEvent(event: RecordedEvent): string | null {
  try {
    return JSON.stringify(event, replacer);
  } catch {
    try {
      return JSON.stringify({ k: event.k, t: event.t, d: { unserializable: true } });
    } catch {
      return null;
    }
  }
}

export function isReplayCheckout(event: RecordedEvent): boolean {
  return event.k === "replay" && (event.d as { type?: unknown } | null)?.type === 4;
}

export function isReplayFullSnapshot(event: RecordedEvent): boolean {
  return event.k === "replay" && (event.d as { type?: unknown } | null)?.type === 2;
}

export function isErrorEvent(event: RecordedEvent): boolean {
  if (event.k === "console") return (event.d as { level?: unknown } | null)?.level === "error";
  if (event.k === "telemetry") return (event.d as { kind?: unknown } | null)?.kind === "error";
  return false;
}
