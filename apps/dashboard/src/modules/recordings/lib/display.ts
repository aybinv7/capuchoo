import type { ChangeValue } from "./changeset";

const MAX_PRETTY = 200_000;

/** A body as readable text: indented when it is JSON, untouched otherwise. */
export function prettyBody(body: string | null): string | null {
  if (body === null || body.length > MAX_PRETTY) return body;
  const trimmed = body.trimStart();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return body;
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

export function displayValue(value: ChangeValue): string {
  if (value === undefined) return "";
  if (value === null) return "NULL";
  if (value instanceof Uint8Array) return `<${value.length} bytes>`;
  if (typeof value === "bigint") return value.toString();
  return String(value);
}

export function columnNames(columns: ReadonlyArray<{ name: string }> | undefined, count: number) {
  return Array.from(
    { length: count },
    (_, index) => columns?.[index]?.name ?? `column ${index + 1}`,
  );
}
