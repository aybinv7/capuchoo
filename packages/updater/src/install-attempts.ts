/** Failed attempts at one version before the app stops holding the user for it. */
export const MAX_FAILED_INSTALLS = 2;

/** Failed installs of one native version, persisted across launches. */
export interface InstallRecord {
  versionCode: number;
  failures: number;
}

export type InstallSettlement =
  | { kind: "installed" }
  | { kind: "not-installed"; failures: number; abandoned: boolean };

/**
 * Settles one handoff to the Android installer from the installed build number,
 * the only evidence there is: the installer reports nothing, and a cancel looks
 * exactly like "App not installed". Returns the outcome and the record to persist.
 */
export function settleInstall(input: {
  offeredVersionCode: number;
  installedVersionCode: number;
  record: InstallRecord | null;
  maxFailures?: number;
}): { settlement: InstallSettlement; record: InstallRecord | null } {
  const { offeredVersionCode, installedVersionCode, record } = input;
  const maxFailures = input.maxFailures ?? MAX_FAILED_INSTALLS;

  if (installedVersionCode >= offeredVersionCode) {
    return { settlement: { kind: "installed" }, record: null };
  }

  const previous = record?.versionCode === offeredVersionCode ? record.failures : 0;
  const failures = previous + 1;

  return {
    settlement: { kind: "not-installed", failures, abandoned: failures >= maxFailures },
    record: { versionCode: offeredVersionCode, failures },
  };
}

/** Whether installing this version has already failed too often to keep insisting on it. */
export function isInstallAbandoned(
  record: InstallRecord | null,
  versionCode: number | undefined,
  maxFailures: number = MAX_FAILED_INSTALLS,
): boolean {
  return record !== null && record.versionCode === versionCode && record.failures >= maxFailures;
}

/** Reads a persisted record, rejecting anything malformed rather than trusting it. */
export function parseInstallRecord(raw: string | null): InstallRecord | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<InstallRecord>;
    return Number.isInteger(value.versionCode) && Number.isInteger(value.failures)
      ? { versionCode: value.versionCode!, failures: value.failures! }
      : null;
  } catch {
    return null;
  }
}
