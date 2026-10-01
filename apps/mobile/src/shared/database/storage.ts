import type { StorageProbe } from "./candidates/types";

export type { StorageProbe };

/**
 * `navigator.storage.getDirectory` is the whole of what a main-thread probe can see. Synchronous
 * access handles are Worker-only in Chromium, so checking `createSyncAccessHandle` on
 * `FileSystemFileHandle.prototype` is false on *every* device - it rejected a phone that had been
 * running OPFS for hours. Anything finer belongs to the engine, via `describeOpenFailure`.
 */
export function probeOpfsCapable(): StorageProbe {
  if (typeof navigator === "undefined" || !navigator.storage?.getDirectory) {
    return {
      supported: false,
      reason:
        "This WebView has no Origin Private File System, so the database cannot be stored. Update " +
        "Android System WebView from the Play Store - it updates separately from Android itself.",
    };
  }

  return { supported: true };
}

export function probeIndexedDb(): StorageProbe {
  if (typeof indexedDB === "undefined") {
    return {
      supported: false,
      reason: "This WebView has no IndexedDB, which leaves nowhere to keep the database.",
    };
  }
  return { supported: true };
}

export function describeOpenFailure(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);

  if (/SyncAccessHandle|createSyncAccessHandle|sahpool|SAH/i.test(detail)) {
    return (
      "SQLite could not take a synchronous file handle. Either this WebView is too old - update " +
      "Android System WebView from the Play Store, it updates separately from Android - or another " +
      `copy of the app still holds the database open. (${detail})`
    );
  }

  return `The database could not be opened: ${detail}`;
}

/**
 * Android System WebView updates from the Play Store independently of Android itself, so the OS
 * version says nothing useful here - a phone on Android 7 can be current and one on Android 14 old.
 */
export function webviewVersion(): number | null {
  if (typeof navigator === "undefined") return null;
  const match = /Chrome\/(\d+)/.exec(navigator.userAgent);
  return match ? Number(match[1]) : null;
}

/** Advice, never a gate: a vendor WebView build can differ either way, so the engine decides. */
export const MINIMUM_CHROMIUM_FOR_OPFS = 109;

export function webviewLikelyTooOld(): boolean {
  const version = webviewVersion();
  return version !== null && version < MINIMUM_CHROMIUM_FOR_OPFS;
}
