import { TraceMap, originalPositionFor, sourceContentFor } from "@jridgewell/trace-mapping";
import { bundlePath, isLibrarySource, parseStack } from "@capuchoo/core";
import type { Deps } from "../../http/context";
import { findSourceMap } from "../../repositories/source-maps";

export interface ResolvedFrame {
  fn: string | null;
  /** The original source when a map covers the frame, the bundle URL otherwise. */
  source: string;
  line: number | null;
  column: number | null;
  /** Code the app did not write: a dependency, the framework, the browser. */
  library: boolean;
  mapped: boolean;
  /** A few lines around the frame, `>` on its own line; only for the app's first frames. */
  code?: string[];
}

/** Maps are large; a dozen is plenty for the stacks one conversation asks about. */
const CACHE_SIZE = 12;
const MAP_BYTES = 24 * 1024 * 1024;
const CONTEXT = 2;
const CODE_FRAMES = 2;

const maps = new Map<string, Promise<TraceMap | null>>();

async function readText(body: NodeJS.ReadableStream): Promise<string | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of body) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    size += buffer.length;
    if (size > MAP_BYTES) return null;
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function loadMap(deps: Deps, appId: string, version: string, path: string) {
  const row = await findSourceMap(deps.db, appId, version, path);
  if (!row) return null;
  const object = await deps.storage.get(row.storage_key).catch(() => null);
  if (!object) return null;
  const text = await readText(object.body);
  if (!text) return null;
  try {
    return new TraceMap(JSON.parse(text) as ConstructorParameters<typeof TraceMap>[0]);
  } catch {
    return null;
  }
}

function mapFor(deps: Deps, appId: string, version: string, path: string) {
  const key = `${appId}\u0000${version}\u0000${path}`;
  const cached = maps.get(key);
  if (cached) {
    maps.delete(key);
    maps.set(key, cached);
    return cached;
  }
  const loading = loadMap(deps, appId, version, path).catch(() => null);
  maps.set(key, loading);
  while (maps.size > CACHE_SIZE) maps.delete(maps.keys().next().value!);
  return loading;
}

const tidy = (source: string) => source.replace(/^(\.\.\/)+/, "").replace(/^\.\//, "");

/**
 * A recorded stack through the source maps uploaded for the app's version: each frame in the app's
 * own code becomes file, line and function, and the first ones carry the code around them.
 */
export async function symbolicate(
  deps: Deps,
  input: { appId: string; version: string; stack: string; maxFrames?: number },
): Promise<ResolvedFrame[]> {
  const frames = parseStack(input.stack).slice(0, input.maxFrames ?? 8);
  let withCode = 0;
  const resolved: ResolvedFrame[] = [];
  for (const frame of frames) {
    const path = bundlePath(frame.url);
    const map = path ? await mapFor(deps, input.appId, input.version, `${path}.map`) : null;
    if (!map || frame.line === null || frame.column === null) {
      resolved.push({
        fn: frame.fn,
        source: frame.url ?? frame.raw,
        line: frame.line,
        column: frame.column,
        library: frame.url === null,
        mapped: false,
      });
      continue;
    }
    const position = originalPositionFor(map, {
      line: frame.line,
      column: Math.max(0, frame.column - 1),
    });
    if (position.source === null || position.line === null) {
      resolved.push({
        fn: frame.fn,
        source: frame.url ?? frame.raw,
        line: frame.line,
        column: frame.column,
        library: false,
        mapped: false,
      });
      continue;
    }
    const source = tidy(position.source);
    const library = isLibrarySource(source);
    const entry: ResolvedFrame = {
      fn: position.name ?? frame.fn,
      source,
      line: position.line,
      column: (position.column ?? 0) + 1,
      library,
      mapped: true,
    };
    if (!library && withCode < CODE_FRAMES) {
      const lines = sourceContentFor(map, position.source)?.split(/\r?\n/);
      if (lines) {
        withCode += 1;
        const from = Math.max(1, position.line - CONTEXT);
        entry.code = lines
          .slice(from - 1, position.line + CONTEXT)
          .map(
            (text, index) =>
              `${from + index === position.line ? ">" : " "} ${from + index} | ${text.slice(0, 200)}`,
          );
      }
    }
    resolved.push(entry);
  }
  return resolved;
}
