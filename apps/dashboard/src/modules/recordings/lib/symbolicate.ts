import type { TraceMap } from "@jridgewell/trace-mapping";
import { bundlePath, isLibrarySource, type ResolvedFrame, type StackFrame } from "./stack";

type TraceMapping = typeof import("@jridgewell/trace-mapping");

let library: Promise<TraceMapping> | null = null;

/** The decoder stays out of the player's chunk until a stack is opened. */
export function loadTraceMapping(): Promise<TraceMapping> {
  library ??= import("@jridgewell/trace-mapping");
  return library;
}

export function parseMap(mapping: TraceMapping, json: unknown): TraceMap {
  return new mapping.TraceMap(json as ConstructorParameters<TraceMapping["TraceMap"]>[0]);
}

const CONTEXT_LINES = 3;
const LINE_BREAK = /\r?\n/;

/** Each frame in the app's own sources where a map covers it; the rest are kept as they were. */
export function resolveFrames(
  mapping: TraceMapping,
  frames: readonly StackFrame[],
  mapFor: (path: string) => TraceMap | null,
): ResolvedFrame[] {
  const sources = new Map<string, string[] | null>();
  const linesOf = (map: TraceMap, source: string) => {
    if (!sources.has(source)) {
      sources.set(source, mapping.sourceContentFor(map, source)?.split(LINE_BREAK) ?? null);
    }
    return sources.get(source) ?? null;
  };

  return frames.map((frame) => {
    const path = bundlePath(frame.url);
    const map = path ? mapFor(`${path}.map`) : null;
    if (!map || frame.line === null || frame.column === null) {
      return { ...frame, original: null, library: frame.url === null };
    }
    const position = mapping.originalPositionFor(map, {
      line: frame.line,
      column: Math.max(0, frame.column - 1),
    });
    if (position.source === null || position.line === null) {
      return { ...frame, original: null, library: false };
    }
    const source = position.source.replace(/^(\.\.\/)+/, "").replace(/^\.\//, "");
    const lines = linesOf(map, position.source);
    const start = Math.max(1, position.line - CONTEXT_LINES);
    return {
      ...frame,
      original: {
        source,
        line: position.line,
        column: (position.column ?? 0) + 1,
        name: position.name,
        context: lines
          ? { start, lines: lines.slice(start - 1, position.line + CONTEXT_LINES) }
          : null,
      },
      library: isLibrarySource(source),
    };
  });
}
