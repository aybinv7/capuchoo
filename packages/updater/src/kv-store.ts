import { Capacitor, registerPlugin } from "@capacitor/core";

interface PreferencesPlugin {
  get(options: { key: string }): Promise<{ value: string | null }>;
  set(options: { key: string; value: string }): Promise<void>;
  remove(options: { key: string }): Promise<void>;
}

function preferences(): PreferencesPlugin | null {
  try {
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable("Preferences")) return null;
    return registerPlugin<PreferencesPlugin>("Preferences");
  } catch {
    return null;
  }
}

function local(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Reads a persisted string from `@capacitor/preferences` when installed
 * (reached through Capacitor's registry, never imported), else `localStorage`.
 * Null when absent or no storage is available.
 */
export async function readValue(key: string): Promise<string | null> {
  const native = preferences();
  if (native) {
    try {
      return (await native.get({ key })).value;
    } catch (error) {
      console.warn("[capuchoo] could not read preference", key, error);
    }
  }
  return local()?.getItem(key) ?? null;
}

/** Persists a string. Throws only when no storage at all accepted it. */
export async function writeValue(key: string, value: string): Promise<void> {
  const native = preferences();
  if (native) {
    try {
      await native.set({ key, value });
      return;
    } catch (error) {
      console.warn("[capuchoo] could not write preference", key, error);
    }
  }
  const storage = local();
  if (!storage) throw new Error("No storage is available to remember this setting");
  storage.setItem(key, value);
}

/** Removes a persisted string from every store it may be in. */
export async function removeValue(key: string): Promise<void> {
  const native = preferences();
  if (native) {
    try {
      await native.remove({ key });
    } catch (error) {
      console.warn("[capuchoo] could not remove preference", key, error);
    }
  }
  local()?.removeItem(key);
}
