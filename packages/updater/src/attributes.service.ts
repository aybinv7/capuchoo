import {
  applyAttributePatch,
  normaliseDeviceAttributes,
  type DeviceAttributePatch,
  type DeviceAttributes,
} from "@capuchoo/core";
import { describeConfigProblems, getUpdaterConfig } from "./config.js";
import { getDeviceId, getPlatform } from "./device.js";
import { HttpError, requestJson } from "./http.js";
import { readValue, writeValue } from "./kv-store.js";

const STORAGE_KEY = "capuchoo.attributes";

let cached: DeviceAttributes | null | undefined;
let pending: Promise<unknown> = Promise.resolve();

function parse(raw: string | null): DeviceAttributes | null {
  if (!raw) return null;
  try {
    return normaliseDeviceAttributes(JSON.parse(raw))?.attributes ?? null;
  } catch {
    return null;
  }
}

/**
 * The attributes this device carries, or null when the app never set any.
 * Null and `{}` differ: `{}` was cleared and is still sent, so the server forgets
 * what it stored even when the clear itself never reached it.
 */
export async function getDeviceAttributes(): Promise<DeviceAttributes | null> {
  if (cached !== undefined) return cached;
  cached = parse(await readValue(STORAGE_KEY));
  return cached;
}

async function push(attributes: DeviceAttributes): Promise<void> {
  const config = getUpdaterConfig();
  if (describeConfigProblems(config).length > 0) return;
  try {
    await requestJson(`${config.apiUrl}/api/device_attributes`, {
      body: {
        app_id: config.appId,
        device_id: await getDeviceId(),
        platform: getPlatform(),
        attributes,
      },
      timeoutMs: config.timeoutMs,
    });
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return;
    console.warn("[capuchoo] device attributes will be sent with the next update check", error);
  }
}

function serialised<T>(task: () => Promise<T>): Promise<T> {
  const run = pending.then(task, task);
  pending = run.catch(() => undefined);
  return run;
}

async function store(next: DeviceAttributes): Promise<DeviceAttributes> {
  await writeValue(STORAGE_KEY, JSON.stringify(next));
  cached = next;
  void push(next);
  return next;
}

/**
 * Merges `patch` into this device's attributes - `null` removes a key - remembers
 * them, and tells the server without waiting for it. Values that are not a
 * string, finite number or boolean, and keys past the limits, are dropped.
 *
 * These are often personal data: prefer an opaque id over a name or a phone
 * number, never send a credential, and call `clearDeviceAttributes` on sign-out.
 */
export function setDeviceAttributes(patch: DeviceAttributePatch): Promise<DeviceAttributes> {
  return serialised(async () =>
    store(applyAttributePatch((await getDeviceAttributes()) ?? {}, patch)),
  );
}

/** Forgets every attribute, here and on the server. */
export function clearDeviceAttributes(): Promise<DeviceAttributes> {
  return serialised(() => store({}));
}

/** @internal test hook. */
export function __resetAttributesCache(): void {
  cached = undefined;
  pending = Promise.resolve();
}
