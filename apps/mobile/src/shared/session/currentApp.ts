const KEY = "capuchoo.app";

/**
 * The app the phone is working on. Every tab reads this one app, so it is chosen once after
 * sign-in and changed from the top bar; it is a per-phone choice, kept beside the session.
 */
const stored = useLocalStorage<string | null>(KEY, null, { writeDefaults: false });

export const currentAppId = readonly(stored);

export function selectApp(appId: string): void {
  stored.value = appId;
}

export function clearCurrentApp(): void {
  stored.value = null;
}

/**
 * Keeps the choice valid against the apps the account reaches now: one it lost is forgotten, and
 * an account with a single app needs no choosing.
 */
export function alignCurrentApp(appIds: readonly string[]): void {
  if (stored.value && !appIds.includes(stored.value)) stored.value = null;
  if (!stored.value && appIds.length === 1) stored.value = appIds[0]!;
}

/** The current app, for code that must not run without one. */
export function requireCurrentApp(): string {
  if (!stored.value) throw new Error("No app selected");
  return stored.value;
}
