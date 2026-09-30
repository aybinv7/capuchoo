import { parseInstallRecord, type InstallRecord } from "./install-attempts.js";
import { readValue, removeValue, writeValue } from "./kv-store.js";

const STORAGE_KEY = "capuchoo.install-failures";

/** The persisted failed-install record, or null. Never throws. */
export async function loadInstallRecord(): Promise<InstallRecord | null> {
  try {
    return parseInstallRecord(await readValue(STORAGE_KEY));
  } catch {
    return null;
  }
}

/** Persists, or clears with null, the failed-install record. Never throws. */
export async function saveInstallRecord(record: InstallRecord | null): Promise<void> {
  try {
    if (record) await writeValue(STORAGE_KEY, JSON.stringify(record));
    else await removeValue(STORAGE_KEY);
  } catch (error) {
    console.warn("[capuchoo] could not persist the install attempt count", error);
  }
}
