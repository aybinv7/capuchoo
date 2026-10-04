const MAX_TEXT = 2000;
const MAX_DEPTH = 3;
const MAX_KEYS = 40;

function clip(text: string, max = MAX_TEXT): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function walk(value: unknown, depth: number, seen: WeakSet<object>): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return depth === 0 ? value : JSON.stringify(clip(value, 200));
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (typeof value === "symbol") return value.toString();
  if (typeof value === "function") return `ƒ ${value.name || "anonymous"}()`;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (typeof value !== "object") return String(value);
  if (seen.has(value)) return "[Circular]";
  if (depth >= MAX_DEPTH) return Array.isArray(value) ? `Array(${value.length})` : "{…}";
  seen.add(value);
  if (typeof Element !== "undefined" && value instanceof Element) {
    return `<${value.tagName.toLowerCase()}${value.id ? `#${value.id}` : ""}>`;
  }
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_KEYS).map((item) => walk(item, depth + 1, seen));
    return `[${items.join(", ")}${value.length > MAX_KEYS ? ", …" : ""}]`;
  }
  const keys = Object.keys(value);
  const entries = keys
    .slice(0, MAX_KEYS)
    .map((key) => `${key}: ${walk((value as Record<string, unknown>)[key], depth + 1, seen)}`);
  return `{${entries.join(", ")}${keys.length > MAX_KEYS ? ", …" : ""}}`;
}

/** A bounded, never-throwing text rendering of console arguments. */
export function describeArgs(args: readonly unknown[]): string {
  try {
    return clip(args.map((arg) => walk(arg, 0, new WeakSet())).join(" "), MAX_TEXT * 2);
  } catch {
    return "[unprintable]";
  }
}

const MAX_STACK = 4000;
const FRAME_LINE = /(?:\bat |@).*:\d+:\d+\)?\s*$/;

/** The stack an error or error-like value carries, such as one rebuilt from another realm. */
export function stackOf(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const stack = (value as { stack?: unknown }).stack;
  return typeof stack === "string" && stack ? clip(stack, MAX_STACK) : null;
}

/**
 * The frames that led to a call, from a stack captured inside it: the engine's header line and the
 * capturing function's own `skip` frames are dropped, so the first frame is the caller's.
 */
export function callerFrames(stack: string | undefined, skip: number): string | null {
  if (!stack) return null;
  const lines = stack.split("\n");
  const first = lines.findIndex((line) => FRAME_LINE.test(line));
  if (first < 0) return null;
  const frames = lines.slice(first + skip).filter((line) => line.trim());
  return frames.length ? clip(frames.join("\n"), MAX_STACK) : null;
}
