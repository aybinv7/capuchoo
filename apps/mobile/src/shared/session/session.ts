import { Capacitor } from "@capacitor/core";
import { SecureStorage } from "@aparajita/capacitor-secure-storage";
import { shallowRef } from "vue";
import type { Credentials } from "@/shared/api/http";

const KEY = "capuchoo.session";

export interface Session extends Credentials {
  token: string;
  email: string;
  expiresAt: string;
}

/**
 * The signed-in session, kept in the Android Keystore through secure storage: a bearer token in
 * SharedPreferences or localStorage is readable by anything with a backup or a debugger. The
 * browser has no keystore, so `vp dev` falls back to localStorage and says so in the name.
 */
const store = {
  async read(): Promise<string | null> {
    if (!Capacitor.isNativePlatform()) return localStorage.getItem(`${KEY}.insecure`);
    return SecureStorage.getItem(KEY);
  },
  async write(value: string): Promise<void> {
    if (!Capacitor.isNativePlatform()) return localStorage.setItem(`${KEY}.insecure`, value);
    return SecureStorage.setItem(KEY, value);
  },
  async clear(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return localStorage.removeItem(`${KEY}.insecure`);
    return SecureStorage.removeItem(KEY);
  },
};

export const session = shallowRef<Session | null>(null);

function isSession(value: unknown): value is Session {
  const record = value as Partial<Session> | null;
  return Boolean(record?.endpoint && record.token && record.email);
}

/** Restores the stored session before the shell mounts; an expired one is discarded. */
export async function restoreSession(): Promise<Session | null> {
  const raw = await store.read().catch(() => null);
  const parsed: unknown = raw ? JSON.parse(raw) : null;
  if (!isSession(parsed) || Date.parse(parsed.expiresAt) <= Date.now()) {
    session.value = null;
    return null;
  }
  session.value = parsed;
  return parsed;
}

export async function saveSession(value: Session): Promise<void> {
  await store.write(JSON.stringify(value));
  session.value = value;
}

export async function clearSession(): Promise<void> {
  await store.clear().catch(() => undefined);
  session.value = null;
}

/** The current credentials, or a clear error for code that must not run signed out. */
export function credentials(): Session {
  if (!session.value) throw new Error("Not signed in");
  return session.value;
}
