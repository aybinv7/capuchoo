const HIDDEN = new Set(["channel"]);

function show(value: unknown): string {
  if (value === null || value === undefined) return "none";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return `${value}`;
  return JSON.stringify(value) ?? "";
}

/** `from 1.2.0 · to 1.1.0 · reason crash` from an audit row's details, whatever shape it has. */
export function describeDetails(details: unknown): string {
  if (details === null || details === undefined) return "";
  let value = details;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return value as string;
    }
  }
  if (typeof value !== "object" || value === null) return show(value);
  return Object.entries(value as Record<string, unknown>)
    .filter(([key, entry]) => !HIDDEN.has(key) && entry !== undefined)
    .map(([key, entry]) => `${key.replace(/_/g, " ")} ${show(entry)}`)
    .join(" · ");
}

/** The channel name, when the row is about one. */
export function detailChannel(details: unknown): string | null {
  if (details && typeof details === "object" && "channel" in details) {
    const channel = (details as { channel?: unknown }).channel;
    return typeof channel === "string" ? channel : null;
  }
  return null;
}
