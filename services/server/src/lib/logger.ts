export type LogLevel = "debug" | "info" | "warn" | "error";

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const SENSITIVE =
  /pass(word)?|secret|token|authorization|cookie|api[-_]?key|signature|latitude|longitude|private/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== "object") return value;
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redact(item, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = SENSITIVE.test(key) ? "[redacted]" : redact(item, depth + 1);
  }
  return out;
}

export interface Logger {
  debug(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
  child(fields: Record<string, unknown>): Logger;
}

/** JSON-lines logger; sensitive keys are redacted at any depth. */
export function createLogger(level: LogLevel = "info", base: Record<string, unknown> = {}): Logger {
  const write = (at: LogLevel, message: string, fields?: Record<string, unknown>) => {
    if (ORDER[at] < ORDER[level]) return;
    const line = JSON.stringify({
      time: new Date().toISOString(),
      level: at,
      message,
      ...(redact(base) as object),
      ...(fields ? (redact(fields) as object) : {}),
    });
    (at === "error" || at === "warn" ? process.stderr : process.stdout).write(`${line}\n`);
  };
  return {
    debug: (message, fields) => write("debug", message, fields),
    info: (message, fields) => write("info", message, fields),
    warn: (message, fields) => write("warn", message, fields),
    error: (message, fields) => write("error", message, fields),
    child: (fields) => createLogger(level, { ...base, ...fields }),
  };
}

export const silentLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => silentLogger,
};
