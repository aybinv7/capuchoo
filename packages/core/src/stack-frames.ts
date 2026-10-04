/** One frame of a JavaScript stack, as V8 or Gecko printed it. */
export interface StackFrame {
  raw: string;
  fn: string | null;
  url: string | null;
  /** 1-based, as browsers print them. */
  line: number | null;
  column: number | null;
}

const V8_WITH_FN = /^\s*at (?:async )?(.*?) \((.*):(\d+):(\d+)\)\s*$/;
const V8_BARE = /^\s*at (?:async )?(.*):(\d+):(\d+)\s*$/;
const GECKO = /^\s*(.*?)@(.*):(\d+):(\d+)\s*$/;

/** Splits a stack into frames; lines that are not frames, such as the message, are dropped. */
export function parseStack(stack: string): StackFrame[] {
  const frames: StackFrame[] = [];
  for (const raw of stack.split(/\r?\n/)) {
    const named = V8_WITH_FN.exec(raw);
    const bare = named ? null : V8_BARE.exec(raw);
    const gecko = named || bare ? null : GECKO.exec(raw);
    const match = named ?? gecko;
    if (match) {
      frames.push({
        raw: raw.trim(),
        fn: match[1] || null,
        url: match[2]!,
        line: Number(match[3]),
        column: Number(match[4]),
      });
    } else if (bare) {
      frames.push({
        raw: raw.trim(),
        fn: null,
        url: bare[1]!,
        line: Number(bare[2]),
        column: Number(bare[3]),
      });
    }
  }
  return frames;
}

/** The path of a frame's script inside the bundle, which is where its map was uploaded. */
export function bundlePath(url: string | null): string | null {
  if (!url) return null;
  try {
    const path = new URL(url).pathname.replace(/^\/+/, "");
    return path.endsWith(".js") || path.endsWith(".mjs") ? path : null;
  } catch {
    return null;
  }
}

export function isLibrarySource(source: string): boolean {
  return /(^|\/)node_modules\/|^webpack\/|^vite\/|\(rolldown|^\x00/.test(source);
}
