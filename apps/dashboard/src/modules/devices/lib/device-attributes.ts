import type { DeviceAttributes } from "../types/devices.types";

export interface AttributeEntry {
  key: string;
  value: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Attributes as the dashboard keeps them: string, finite number and boolean values only, null
 * when there are none. A server that predates attributes, or a malformed row, reads as none.
 */
export function normalizeAttributes(value: unknown): DeviceAttributes | null {
  if (!isRecord(value)) return null;
  const attributes: DeviceAttributes = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === "string" || typeof raw === "boolean") attributes[key] = raw;
    else if (typeof raw === "number" && Number.isFinite(raw)) attributes[key] = raw;
  }
  return Object.keys(attributes).length ? attributes : null;
}

export function formatAttributeValue(value: DeviceAttributes[string]): string {
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
}

/** Every attribute as display text, in the order the server returned them. */
export function attributeEntries(
  attributes: DeviceAttributes | null | undefined,
): AttributeEntry[] {
  if (!attributes) return [];
  return Object.entries(attributes).map(([key, value]) => ({
    key,
    value: formatAttributeValue(value),
  }));
}

/** The first `limit` attributes for a compact cell, and how many more there are. */
export function attributeChips(
  attributes: DeviceAttributes | null | undefined,
  limit = 2,
): { chips: AttributeEntry[]; hidden: number } {
  const entries = attributeEntries(attributes);
  return { chips: entries.slice(0, limit), hidden: Math.max(0, entries.length - limit) };
}

/** `key: value; key: value`, for exports and tooltips. */
export function attributesText(attributes: DeviceAttributes | null | undefined): string {
  return attributeEntries(attributes)
    .map((entry) => `${entry.key}: ${entry.value}`)
    .join("; ");
}
