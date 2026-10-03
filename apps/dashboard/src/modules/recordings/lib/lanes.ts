import type { RecordedEvent } from "@capuchoo/core";
import { decodeChangeset, fromBase64, type ChangeValue, type DecodedChange } from "./changeset";
import type {
  ConsoleLaneEntry,
  DatabaseColumn,
  DatabaseLaneEntry,
  Lanes,
  MarkerLaneEntry,
  NetworkLaneEntry,
  PerfLaneEntry,
  TelemetryLaneEntry,
} from "../types/recordings.types";

type Data = Record<string, unknown>;

const text = (value: unknown): string | null => (typeof value === "string" ? value : null);
const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
const record = (value: unknown): Data | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Data) : null;
const strings = (value: unknown): Record<string, string> =>
  Object.fromEntries(
    Object.entries(record(value) ?? {}).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );

export function emptyLanes(): Lanes {
  return {
    replay: [],
    console: [],
    network: [],
    database: [],
    telemetry: [],
    perf: [],
    markers: [],
    schemas: {},
    snapshots: {},
  };
}

const LEVELS = new Set(["log", "info", "warn", "error", "debug"]);

const MARKER_LABELS: Record<string, (data: Data) => string> = {
  route: (data) => `Navigated to ${text(data.url) ?? "?"}`,
  trigger: (data) => `Recording raised by ${text(data.trigger) ?? "a trigger"}`,
  escalate: (data) => `App raised recording to ${text(data.mode) ?? "?"}`,
  "replay-paused": () => "Screen recording paused: the page changed too fast",
  "database-unsupported": (data) =>
    `${text(data.db) ?? "Database"}: ${text(data.reason) ?? "not recorded"}`,
};

function sortedInsert<T extends { t: number }>(lane: T[], entry: T): void {
  let index = lane.length;
  while (index > 0 && lane[index - 1]!.t > entry.t) index--;
  lane.splice(index, 0, entry);
}

/** A trigger-captured row, keyed by column name, laid out like a changeset row. */
function rowChange(
  raw: Data,
  columns: readonly DatabaseColumn[] | undefined,
): DecodedChange | null {
  const table = text(raw.table);
  const op = raw.op === "insert" || raw.op === "update" || raw.op === "delete" ? raw.op : null;
  if (!table || !op) return null;
  const before = record(raw.old);
  const after = record(raw.new);
  const names = columns?.map((column) => column.name) ?? Object.keys(after ?? before ?? {});
  const primaryKey = names.map(
    (name) => (columns?.find((column) => column.name === name)?.pk ?? 0) > 0,
  );
  const layout = (row: Data | null) =>
    names.map((name) => (row ? ((row[name] as ChangeValue) ?? null) : undefined));
  if (op === "update" && before && after) {
    const old = layout(before);
    const next = layout(after);
    return {
      table,
      op,
      indirect: false,
      primaryKey,
      old: old.map((value, index) =>
        primaryKey[index] || value !== next[index] ? value : undefined,
      ),
      new: next.map((value, index) =>
        !primaryKey[index] && value !== old[index] ? value : undefined,
      ),
    };
  }
  return {
    table,
    op,
    indirect: false,
    primaryKey,
    old: op === "insert" ? [] : layout(before),
    new: op === "delete" ? [] : layout(after),
  };
}

function databaseEntry(
  id: string,
  t: number,
  data: Data,
  schemas: Lanes["schemas"],
): DatabaseLaneEntry | null {
  const db = text(data.db) ?? "database";
  if (data.kind === "rows" && Array.isArray(data.changes)) {
    const changes = (data.changes as Data[])
      .map((raw) => rowChange(raw, schemas[db]?.[text(raw.table) ?? ""]))
      .filter((change): change is DecodedChange => change !== null);
    return { id, t, db, kind: "rows", changes, table: null, type: null, rows: null, error: null };
  }
  if (data.kind === "changeset") {
    const encoded = text(record(data.bytes)?.$b64);
    if (!encoded) return null;
    try {
      return {
        id,
        t,
        db,
        kind: "changeset",
        changes: decodeChangeset(fromBase64(encoded)),
        table: null,
        type: null,
        rows: null,
        error: null,
      };
    } catch (error) {
      return {
        id,
        t,
        db,
        kind: "changeset",
        changes: [],
        table: null,
        type: null,
        rows: null,
        error: error instanceof Error ? error.message : "unreadable changeset",
      };
    }
  }
  if (data.kind === "change") {
    const change = record(data.change) ?? {};
    return {
      id,
      t,
      db,
      kind: "change",
      changes: [],
      table: text(change.table),
      type: text(change.type),
      rows: num(change.rows),
      error: null,
    };
  }
  return null;
}

/**
 * Sorts one segment's events into lanes. Lanes stay ordered by time across appends, which is what
 * lets a live session grow without re-sorting everything already shown.
 */
export function appendToLanes(
  lanes: Lanes,
  events: readonly RecordedEvent[],
  prefix: string,
): void {
  events.forEach((event, index) => {
    const id = `${prefix}:${index}`;
    const data = record(event.d) ?? {};
    switch (event.k) {
      case "replay": {
        const replay = event.d as Lanes["replay"][number];
        if (replay && typeof replay.timestamp === "number")
          sortedInsertReplay(lanes.replay, replay);
        return;
      }
      case "console": {
        const level = text(data.level);
        sortedInsert<ConsoleLaneEntry>(lanes.console, {
          id,
          t: event.t,
          level: (level && LEVELS.has(level) ? level : "log") as ConsoleLaneEntry["level"],
          text: text(data.text) ?? "",
          stack: text(data.stack),
          source: text(data.source) ?? "console",
        });
        return;
      }
      case "network":
        sortedInsert<NetworkLaneEntry>(lanes.network, {
          id,
          t: event.t,
          transport: text(data.transport) ?? "fetch",
          method: text(data.method) ?? "GET",
          url: text(data.url) ?? "",
          status: num(data.status),
          duration: num(data.duration) ?? 0,
          error: text(data.error),
          traceId: text(data.traceId),
          requestHeaders: strings(data.requestHeaders),
          responseHeaders: strings(data.responseHeaders),
          requestBody: text(data.requestBody),
          responseBody: text(data.responseBody),
          responseSize: num(data.responseSize),
        });
        return;
      case "database": {
        if (data.kind === "schema" && Array.isArray(data.tables)) {
          const db = text(data.db) ?? "database";
          const tables: Record<string, DatabaseColumn[]> = (lanes.schemas[db] ??= {});
          for (const table of data.tables as Data[]) {
            const name = text(table.name);
            if (name && Array.isArray(table.columns))
              tables[name] = table.columns as DatabaseColumn[];
          }
          return;
        }
        if (data.kind === "snapshot") {
          addSnapshotChunk(lanes, event.t, data);
          return;
        }
        const entry = databaseEntry(id, event.t, data, lanes.schemas);
        if (entry) sortedInsert(lanes.database, entry);
        return;
      }
      case "telemetry":
        sortedInsert<TelemetryLaneEntry>(lanes.telemetry, {
          id,
          t: event.t,
          kind: text(data.kind) ?? "event",
          name: text(data.name) ?? text(data.message) ?? "event",
          duration: num(data.duration),
          data: record(data.data),
          message: text(data.message),
        });
        return;
      case "perf":
        sortedInsert<PerfLaneEntry>(lanes.perf, {
          id,
          t: event.t,
          kind: text(data.kind) ?? "sample",
          value: num(data.value) ?? num(data.used),
          duration: num(data.duration),
          name: text(data.name),
        });
        return;
      case "marker": {
        const kind = text(data.kind) ?? "marker";
        sortedInsert<MarkerLaneEntry>(lanes.markers, {
          id,
          t: event.t,
          kind,
          label: MARKER_LABELS[kind]?.(data) ?? kind,
          data,
        });
        return;
      }
      default:
        return;
    }
  });
}

function sortedInsertReplay(lane: Lanes["replay"], event: Lanes["replay"][number]): void {
  let index = lane.length;
  while (index > 0 && lane[index - 1]!.timestamp > event.timestamp) index--;
  lane.splice(index, 0, event);
}

/** Index of the last entry at or before `time`, or -1. */
export function lastAtOrBefore(lane: readonly { t: number }[], time: number): number {
  let low = 0;
  let high = lane.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (lane[middle]!.t <= time) {
      found = middle;
      low = middle + 1;
    } else high = middle - 1;
  }
  return found;
}

function addSnapshotChunk(lanes: Lanes, t: number, data: Data): void {
  const db = text(data.db) ?? "database";
  const table = text(data.table);
  if (!table || !Array.isArray(data.columns) || !Array.isArray(data.rows)) return;
  const tables = (lanes.snapshots[db] ??= {});
  const existing = tables[table];
  if (existing && num(data.offset) === 0) return;
  const snapshot = existing ?? {
    columns: (data.columns as unknown[]).map(String),
    rows: [],
    at: t,
    truncated: false,
  };
  snapshot.rows.push(...(data.rows as unknown[][]));
  snapshot.truncated = snapshot.truncated || data.truncated === true;
  tables[table] = snapshot;
}
