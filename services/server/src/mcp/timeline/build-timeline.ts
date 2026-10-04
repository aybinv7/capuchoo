import type { RecordedEvent } from "@capuchoo/core";

export type TimelineKind =
  | "step"
  | "route"
  | "error"
  | "warning"
  | "log"
  | "request"
  | "trigger"
  | "note"
  | "database";

export interface TimelineItem {
  /** Milliseconds from the session's start. */
  at_ms: number;
  kind: TimelineKind;
  text: string;
}

export interface TimelineError {
  at_ms: number;
  message: string;
  source: string;
  stack: string | null;
}

export interface Timeline {
  duration_ms: number;
  counts: {
    steps: number;
    errors: number;
    warnings: number;
    requests: number;
    failed_requests: number;
    slow_requests: number;
  };
  errors: TimelineError[];
  items: TimelineItem[];
  /** Items left out to stay within `maxItems`, oldest first dropped. */
  omitted: number;
}

export interface TimelineOptions {
  /** `errors` keeps what happened around each error; `all` keeps everything. */
  focus: "errors" | "all";
  /** Kept before each error in `errors` focus. */
  beforeMs: number;
  /** Kept after each error in `errors` focus. */
  afterMs: number;
  maxItems: number;
}

export const SLOW_REQUEST_MS = 2000;
const TEXT_LIMIT = 300;

const clip = (value: string, limit = TEXT_LIMIT) =>
  value.length > limit ? `${value.slice(0, limit - 1)}…` : value;

/** A recorded field as text: strings and numbers only, anything else is empty. */
const text = (value: unknown): string =>
  typeof value === "string" ? value : typeof value === "number" ? String(value) : "";

/** Host and path, with query values hidden: they are where tokens and personal data travel. */
export function safeUrl(raw: string): string {
  try {
    const url = new URL(raw);
    const keys = [...new Set(url.searchParams.keys())];
    const query = keys.length ? `?${keys.map((key) => `${key}=…`).join("&")}` : "";
    return clip(`${url.host}${url.pathname}${query}`, 160);
  } catch {
    return clip(raw.split("?")[0] ?? raw, 160);
  }
}

interface StepData {
  action?: string;
  target?: {
    name?: string | null;
    text?: string | null;
    id?: string | null;
    css?: string;
    testId?: { value: string } | null;
  };
  value?: string | null;
  masked?: boolean;
  key?: string;
  checked?: boolean;
}

function describeStep(step: StepData): string {
  const target = step.target ?? {};
  const label = target.name ?? target.text ?? null;
  const locator = target.testId
    ? `[data-testid=${target.testId.value}]`
    : target.id
      ? `#${target.id}`
      : (target.css ?? "");
  const what = label ? `"${clip(label, 60)}"` : locator;
  const where = label && locator ? ` (${clip(locator, 60)})` : "";
  switch (step.action) {
    case "type":
      return `type ${what}${where} = ${step.masked || step.value === null ? "•••" : `"${clip(step.value ?? "", 80)}"`}`;
    case "key":
      return `key ${step.key ?? ""} on ${what}${where}`;
    case "check":
      return `${step.checked ? "check" : "uncheck"} ${what}${where}`;
    case "select":
      return `select ${step.masked ? "•••" : `"${clip(step.value ?? "", 60)}"`} in ${what}${where}`;
    default:
      return `${step.action ?? "tap"} ${what}${where}`;
  }
}

/** What a database line wrote, as `db update orders ×2, insert order_lines`; values are left out. */
function describeWrite(data: Record<string, unknown>): string | null {
  const counts = new Map<string, number>();
  const add = (op: unknown, table: unknown, rows = 1) => {
    if (typeof op !== "string" || typeof table !== "string") return;
    const key = `${op} ${table}`;
    counts.set(key, (counts.get(key) ?? 0) + rows);
  };
  if (data.kind === "rows" && Array.isArray(data.changes)) {
    for (const change of data.changes as Array<Record<string, unknown>>)
      add(change.op, change.table);
  } else if (data.kind === "change" && data.change && typeof data.change === "object") {
    const change = data.change as Record<string, unknown>;
    add(change.type, change.table, typeof change.rows === "number" ? change.rows : 1);
  }
  if (counts.size === 0) return null;
  const parts = [...counts].map(([key, rows]) => (rows > 1 ? `${key} ×${rows}` : key));
  return clip(`db ${parts.join(", ")}`, 200);
}

function itemOf(event: RecordedEvent, start: number): TimelineItem | TimelineError | null {
  const at = Math.max(0, event.t - start);
  const data = (event.d ?? {}) as Record<string, unknown>;
  switch (event.k) {
    case "marker": {
      if (data.kind === "step")
        return { at_ms: at, kind: "step", text: describeStep(data as StepData) };
      if (data.kind === "route")
        return { at_ms: at, kind: "route", text: `route ${clip(text(data.url), 160)}` };
      if (data.kind === "trigger") {
        const note =
          typeof data.note === "string" && data.note ? `: "${clip(data.note, 200)}"` : "";
        return {
          at_ms: at,
          kind: "trigger",
          text: `recording raised by ${text(data.trigger) || "trigger"}${note}`,
        };
      }
      if (data.kind === "note" && typeof data.note === "string") {
        return { at_ms: at, kind: "note", text: `user note: "${clip(data.note, 300)}"` };
      }
      return null;
    }
    case "console": {
      const level = text(data.level) || "log";
      const said = clip(text(data.text));
      if (level === "error") {
        return {
          at_ms: at,
          message: said,
          source: text(data.source) || "console",
          stack: typeof data.stack === "string" ? data.stack : null,
        };
      }
      return { at_ms: at, kind: level === "warn" ? "warning" : "log", text: `${level} ${said}` };
    }
    case "network": {
      const status = typeof data.status === "number" ? data.status : null;
      const duration = typeof data.duration === "number" ? Math.round(data.duration) : null;
      const failure =
        typeof data.error === "string" && data.error ? ` failed: ${clip(data.error, 120)}` : "";
      const flags = [
        status !== null && status >= 400 ? "FAILED" : "",
        duration !== null && duration >= SLOW_REQUEST_MS ? "SLOW" : "",
      ].filter(Boolean);
      return {
        at_ms: at,
        kind: "request",
        text: `${text(data.method) || "GET"} ${safeUrl(text(data.url))} ${status ?? "-"}${duration !== null ? ` ${duration}ms` : ""}${failure}${flags.length ? ` [${flags.join(", ")}]` : ""}`,
      };
    }
    case "telemetry": {
      if (data.kind === "error") {
        return {
          at_ms: at,
          message: clip(text(data.message) || text(data.name) || "telemetry error"),
          source: "telemetry",
          stack: typeof data.stack === "string" ? data.stack : null,
        };
      }
      return null;
    }
    case "database": {
      const summary = describeWrite(data);
      return summary ? { at_ms: at, kind: "database", text: summary } : null;
    }
    default:
      return null;
  }
}

const isError = (value: TimelineItem | TimelineError): value is TimelineError => "message" in value;

const isFailedRequest = (item: TimelineItem) =>
  item.kind === "request" && item.text.includes("[FAILED");

/**
 * A session as a model reads it: what the user did, where they went, what the app logged and
 * requested, and the errors with their stacks, each at its offset from the start. In `errors`
 * focus only what happened around an error is kept, plus every failed request and trigger.
 */
export function buildTimeline(
  events: readonly RecordedEvent[],
  start: number,
  end: number,
  options: TimelineOptions,
): Timeline {
  const sorted = [...events].sort((a, b) => a.t - b.t);
  const errors: TimelineError[] = [];
  const all: TimelineItem[] = [];
  const counts = {
    steps: 0,
    errors: 0,
    warnings: 0,
    requests: 0,
    failed_requests: 0,
    slow_requests: 0,
  };
  for (const event of sorted) {
    const value = itemOf(event, start);
    if (!value) continue;
    if (isError(value)) {
      counts.errors += 1;
      errors.push(value);
      all.push({ at_ms: value.at_ms, kind: "error", text: value.message });
      continue;
    }
    if (value.kind === "step") counts.steps += 1;
    if (value.kind === "warning") counts.warnings += 1;
    if (value.kind === "request") {
      counts.requests += 1;
      if (isFailedRequest(value)) counts.failed_requests += 1;
      if (value.text.includes("SLOW")) counts.slow_requests += 1;
    }
    all.push(value);
  }

  let kept = all;
  if (options.focus === "errors" && errors.length > 0) {
    const windows = errors.map((error) => [
      error.at_ms - options.beforeMs,
      error.at_ms + options.afterMs,
    ]);
    kept = all.filter(
      (item) =>
        item.kind === "trigger" ||
        item.kind === "note" ||
        isFailedRequest(item) ||
        windows.some(([from, to]) => item.at_ms >= from! && item.at_ms <= to!),
    );
  } else if (options.focus === "errors") {
    kept = all.filter((item) => item.kind !== "log" && item.kind !== "database");
  }
  const omitted = Math.max(0, kept.length - options.maxItems);
  return {
    duration_ms: Math.max(0, end - start),
    counts,
    errors: errors.slice(0, 20),
    items: omitted > 0 ? kept.slice(omitted) : kept,
    omitted,
  };
}

/** `m:ss` for the model, which reasons better over a clock than over milliseconds. */
export function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}
