import { stripAnsi } from "@/shared/lib/ansi";
import type { LogLine } from "../types/job-logs.types";

const plainCache = new WeakMap<LogLine, string>();

/** A line's text without terminal styling, computed once per line. */
export function plainText(line: LogLine): string {
  let value = plainCache.get(line);
  if (value === undefined) {
    value = stripAnsi(line.text);
    plainCache.set(line, value);
  }
  return value;
}

export const normalizeQuery = (query: string): string => query.trim().toLowerCase();

export const lineMatches = (line: LogLine, needle: string): boolean =>
  needle !== "" && line.kind !== "endgroup" && plainText(line).toLowerCase().includes(needle);

/** How many lines contain the (already normalized) search text. */
export function countMatches(lines: readonly LogLine[], needle: string): number {
  if (!needle) return 0;
  let count = 0;
  for (const line of lines) if (lineMatches(line, needle)) count += 1;
  return count;
}

export interface LogRow {
  /** The line's number in its step, starting at 1; also the row's identity. */
  number: number;
  line: LogLine;
  kind: "line" | "group";
  /** Inside a group: drawn indented. */
  nested: boolean;
  /** For a group header: whether its lines are shown, and how many it holds. */
  open: boolean;
  size: number;
  match: boolean;
}

export interface LogRowsInput {
  lines: readonly LogLine[];
  /** Group headers (by line number) the reader flipped from their default state. */
  toggled: ReadonlySet<number>;
  /** Normalized search text; groups holding a match open by themselves. */
  needle: string;
}

export interface LogRows {
  rows: LogRow[];
  matches: number;
  /** Groups start closed only when the log marks where they end. */
  groupsOpenByDefault: boolean;
}

interface Group {
  header: LogRow;
  members: LogRow[];
  hasMatch: boolean;
}

/**
 * The rows to draw for one step's log. A `group` line heads the lines after it until an
 * `endgroup` marker, the next group or the end of the step. Without end markers a group's extent
 * is a guess, so groups then start open: a wrong guess must never hide output.
 */
export function buildLogRows({ lines, toggled, needle }: LogRowsInput): LogRows {
  const groupsOpenByDefault = !lines.some((line) => line.kind === "endgroup");
  const items: Array<LogRow | Group> = [];
  let group: Group | null = null;
  let number = 0;
  let matches = 0;

  for (const line of lines) {
    if (line.kind === "endgroup") {
      group = null;
      continue;
    }
    number += 1;
    const match = lineMatches(line, needle);
    if (match) matches += 1;
    if (line.kind === "group") {
      group = {
        header: { number, line, kind: "group", nested: false, open: true, size: 0, match },
        members: [],
        hasMatch: match,
      };
      items.push(group);
      continue;
    }
    const row: LogRow = {
      number,
      line,
      kind: "line",
      nested: group !== null,
      open: false,
      size: 0,
      match,
    };
    if (group) {
      group.members.push(row);
      if (match) group.hasMatch = true;
    } else {
      items.push(row);
    }
  }

  const rows: LogRow[] = [];
  for (const item of items) {
    if (!("members" in item)) {
      rows.push(item);
      continue;
    }
    const flipped = toggled.has(item.header.number);
    const open = (flipped ? !groupsOpenByDefault : groupsOpenByDefault) || item.hasMatch;
    rows.push({ ...item.header, open, size: item.members.length });
    if (open) for (const member of item.members) rows.push(member);
  }
  return { rows, matches, groupsOpenByDefault };
}

const timeFormat = new Intl.DateTimeFormat("en", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** `14:03:27` in the reader's time zone, or an empty string for a line without a time. */
export function formatLogTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : timeFormat.format(date);
}

/** A step's log as plain text, for the clipboard. */
export function logText(lines: readonly LogLine[], withTime: boolean): string {
  const out: string[] = [];
  for (const line of lines) {
    if (line.kind === "endgroup") continue;
    const time = withTime ? formatLogTime(line.time) : "";
    out.push(time ? `${time} ${plainText(line)}` : plainText(line));
  }
  return out.join("\n");
}

/** The widest line in characters, so a windowed log can size its horizontal scroll. */
export function widestLine(lines: readonly LogLine[]): number {
  let widest = 0;
  for (const line of lines) widest = Math.max(widest, plainText(line).length);
  return widest;
}
