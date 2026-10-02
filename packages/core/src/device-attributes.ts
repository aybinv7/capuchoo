/**
 * Key/value pairs an app attaches to its device - the signed-in rep, a route, a store - so the
 * people testing a release can tell whose device is whose. Validated the same way in the app,
 * which drops what it would not send, and on the server, which drops what it will not store.
 */

export const DEVICE_ATTRIBUTE_LIMITS = {
  keys: 20,
  keyLength: 40,
  valueLength: 200,
  totalBytes: 4096,
} as const;

export type DeviceAttributeValue = string | number | boolean;
export type DeviceAttributes = Record<string, DeviceAttributeValue>;
/** An update: `null` removes the key. */
export type DeviceAttributePatch = Record<string, DeviceAttributeValue | null>;

const KEY = /^[A-Za-z][A-Za-z0-9_.-]{0,39}$/;

export interface NormalisedAttributes {
  attributes: DeviceAttributes;
  /** Keys refused, with the reason, so the app can log what it got wrong. */
  dropped: Array<{ key: string; reason: string }>;
}

function value(raw: unknown): DeviceAttributeValue | undefined {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    return trimmed ? trimmed.slice(0, DEVICE_ATTRIBUTE_LIMITS.valueLength) : undefined;
  }
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : undefined;
  if (typeof raw === "boolean") return raw;
  return undefined;
}

const size = (attributes: DeviceAttributes): number =>
  new TextEncoder().encode(JSON.stringify(attributes)).length;

/** The storable subset of untrusted input; null when the input is not an object at all. */
export function normaliseDeviceAttributes(input: unknown): NormalisedAttributes | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const attributes: DeviceAttributes = {};
  const dropped: NormalisedAttributes["dropped"] = [];
  for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
    if (!KEY.test(key)) {
      dropped.push({ key: key.slice(0, 60), reason: "not a valid key" });
      continue;
    }
    if (Object.keys(attributes).length >= DEVICE_ATTRIBUTE_LIMITS.keys) {
      dropped.push({ key, reason: `more than ${DEVICE_ATTRIBUTE_LIMITS.keys} keys` });
      continue;
    }
    const parsed = value(raw);
    if (parsed === undefined) {
      dropped.push({ key, reason: "not a string, finite number or boolean" });
      continue;
    }
    attributes[key] = parsed;
    if (size(attributes) > DEVICE_ATTRIBUTE_LIMITS.totalBytes) {
      delete attributes[key];
      dropped.push({ key, reason: `over ${DEVICE_ATTRIBUTE_LIMITS.totalBytes} bytes in all` });
    }
  }
  return { attributes, dropped };
}

/** Applies a patch: `null` removes a key, anything else replaces it. */
export function applyAttributePatch(
  current: DeviceAttributes,
  patch: DeviceAttributePatch,
): DeviceAttributes {
  const next: Record<string, unknown> = { ...current };
  for (const [key, raw] of Object.entries(patch)) {
    if (raw === null) delete next[key];
    else next[key] = raw;
  }
  return normaliseDeviceAttributes(next)?.attributes ?? {};
}
