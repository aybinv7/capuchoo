import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import { gzipSync } from "node:zlib";
import type { StorageDriver } from "../storage/driver";
import crash from "./fixtures/order-crash.json" with { type: "json" };
import clean from "./fixtures/order-clean.json" with { type: "json" };

interface Line {
  k: string;
  t: number;
  d: unknown;
}

interface Fixture {
  start: number;
  segments: Line[][];
}

/**
 * Two sessions the real recorder captured on a Northwind order screen: one where applying a
 * discount throws, one where the order goes through. Every demo session replays one of them,
 * moved to its own start, so the demo player shows a real screen, console and network.
 */
const FIXTURES = { crash: crash as Fixture, clean: clean as Fixture };
const CRASH_MESSAGE = "Cannot read properties of undefined (reading 'lines')";
/** Fixture segments are merged into this many, so a demo seed writes few blobs. */
const PARTS = 2;

export type ContentKind = keyof typeof FIXTURES;

export interface SegmentWrite {
  seq: number;
  storageKey: string;
  sizeBytes: number;
  rawBytes: number;
  events: number;
  errors: number;
  fullSnapshot: boolean;
  startedAt: Date;
  endedAt: Date;
}

export interface SessionContent {
  durationMs: number;
  events: number;
  errors: number;
  bytes: number;
  segments: SegmentWrite[];
}

const bounds = (fixture: Fixture) => {
  const times = fixture.segments.flat().map((line) => line.t);
  return { first: Math.min(...times), last: Math.max(...times) };
};

const DURATION = {
  crash: bounds(FIXTURES.crash),
  clean: bounds(FIXTURES.clean),
};

/** Every wall-clock time inside the fixture's span, moved by `shift`; ids and sizes are left. */
function moved(value: unknown, low: number, high: number, shift: number): unknown {
  if (typeof value === "number") return value >= low && value <= high ? value + shift : value;
  if (Array.isArray(value)) return value.map((item) => moved(item, low, high, shift));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) out[key] = moved(item, low, high, shift);
    return out;
  }
  return value;
}

const isError = (line: Line) => {
  const data = line.d as { level?: unknown; kind?: unknown } | null;
  return (
    (line.k === "console" && data?.level === "error") ||
    (line.k === "telemetry" && data?.kind === "error")
  );
};

const isFullSnapshot = (line: Line) =>
  line.k === "replay" && (line.d as { type?: unknown } | null)?.type === 2;

export function contentDuration(kind: ContentKind): number {
  return DURATION[kind].last - DURATION[kind].first;
}

/**
 * Writes a fixture's lines for one session to storage: its times moved to `startedAt`, and the
 * crash's message replaced by the error the session is filed under.
 */
export async function writeSessionContent(
  storage: StorageDriver,
  input: {
    appId: string;
    sessionKey: string;
    kind: ContentKind;
    startedAt: Date;
    error?: { message: string; frame: string };
  },
): Promise<SessionContent> {
  const fixture = FIXTURES[input.kind];
  const span = DURATION[input.kind];
  const shift = input.startedAt.getTime() - span.first;
  const low = span.first - 3_600_000;
  const high = span.last + 3_600_000;
  const per = Math.ceil(fixture.segments.length / PARTS);
  const segments: SegmentWrite[] = [];
  let events = 0;
  let errors = 0;
  let bytes = 0;
  for (let part = 0; part < PARTS; part += 1) {
    const lines = fixture.segments
      .slice(part * per, (part + 1) * per)
      .flat()
      .map((line) => moved(line, low, high, shift) as Line);
    if (lines.length === 0) continue;
    let text = `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`;
    if (input.error && input.kind === "crash") {
      text = text
        .replaceAll(`TypeError: ${CRASH_MESSAGE}`, input.error.message)
        .replaceAll(CRASH_MESSAGE, input.error.message.replace(/^\w+: /, ""));
    }
    const raw = Buffer.from(text, "utf8");
    const body = gzipSync(raw);
    const seq = segments.length;
    const storageKey = `recordings/${input.appId}/${input.sessionKey}/${seq}-${randomUUID()}.ndjson.gz`;
    await storage.put(storageKey, Readable.from(body), "application/gzip");
    const partErrors = lines.filter(isError).length;
    const times = lines.map((line) => line.t);
    segments.push({
      seq,
      storageKey,
      sizeBytes: body.length,
      rawBytes: raw.length,
      events: lines.length,
      errors: partErrors,
      fullSnapshot: lines.some(isFullSnapshot),
      startedAt: new Date(Math.min(...times)),
      endedAt: new Date(Math.max(...times)),
    });
    events += lines.length;
    errors += partErrors;
    bytes += body.length;
  }
  return { durationMs: span.last - span.first, events, errors, bytes, segments };
}
