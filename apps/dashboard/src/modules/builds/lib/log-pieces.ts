import { ansiPresentation, parseAnsi, type AnsiSegment, type AnsiStyle } from "@/shared/lib/ansi";
import type { LogLine } from "../types/job-logs.types";

/** A run of a log line ready to draw as a text node: classes, validated inline values, a match flag. */
export interface LogPiece {
  text: string;
  class: string;
  style: Record<string, string> | undefined;
  match: boolean;
}

const segmentCache = new WeakMap<LogLine, AnsiSegment[]>();
const plainPieces = new WeakMap<LogLine, LogPiece[]>();
const presentationCache = new WeakMap<AnsiStyle, ReturnType<typeof ansiPresentation>>();
const NO_STYLE = ansiPresentation(null);

function segmentsOf(line: LogLine): AnsiSegment[] {
  let segments = segmentCache.get(line);
  if (!segments) {
    segments = parseAnsi(line.text);
    segmentCache.set(line, segments);
  }
  return segments;
}

function present(style: AnsiStyle | null) {
  if (!style) return NO_STYLE;
  let value = presentationCache.get(style);
  if (!value) {
    value = ansiPresentation(style);
    presentationCache.set(style, value);
  }
  return value;
}

/** Start and end offsets of every non-overlapping, case-insensitive occurrence of `needle`. */
export function matchRanges(text: string, needle: string): Array<[number, number]> {
  if (!needle) return [];
  const haystack = text.toLowerCase();
  if (haystack.length !== text.length) return [];
  const ranges: Array<[number, number]> = [];
  let from = haystack.indexOf(needle);
  while (from !== -1) {
    ranges.push([from, from + needle.length]);
    from = haystack.indexOf(needle, from + needle.length);
  }
  return ranges;
}

/**
 * Cuts styled segments at match boundaries, so a match spanning two colours is still marked and
 * each colour is kept. Pure: the same segments and needle give the same pieces.
 */
export function splitMatches(
  segments: readonly AnsiSegment[],
  needle: string,
): Array<AnsiSegment & { match: boolean }> {
  const text = segments.map((segment) => segment.text).join("");
  const ranges = matchRanges(text, needle);
  if (ranges.length === 0) return segments.map((segment) => ({ ...segment, match: false }));

  const out: Array<AnsiSegment & { match: boolean }> = [];
  let offset = 0;
  let range = 0;
  for (const segment of segments) {
    const end = offset + segment.text.length;
    let cursor = offset;
    while (cursor < end) {
      while (range < ranges.length && ranges[range]![1] <= cursor) range += 1;
      const current = ranges[range];
      const inside = current !== undefined && current[0] <= cursor;
      const stop = inside ? Math.min(end, current[1]) : Math.min(end, current?.[0] ?? end);
      out.push({
        text: segment.text.slice(cursor - offset, stop - offset),
        style: segment.style,
        match: inside,
      });
      cursor = stop;
    }
    offset = end;
  }
  return out;
}

/** The pieces to draw for one line, highlighting `needle` when given. */
export function linePieces(line: LogLine, needle: string): LogPiece[] {
  if (!needle) {
    let cached = plainPieces.get(line);
    if (!cached) {
      cached = segmentsOf(line).map((segment) => ({
        text: segment.text,
        ...present(segment.style),
        match: false,
      }));
      plainPieces.set(line, cached);
    }
    return cached;
  }
  return splitMatches(segmentsOf(line), needle).map((piece) => ({
    text: piece.text,
    ...present(piece.style),
    match: piece.match,
  }));
}
