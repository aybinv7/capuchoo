/** Sessions an app version recorded, and how many of them saw an error. */
export interface VersionSessions {
  version: string;
  sessions: number;
  error_sessions: number;
  devices: number;
}

/** Fewer sessions than this say nothing about a version. */
const MIN_SESSIONS = 5;

export const errorRate = (row: Pick<VersionSessions, "sessions" | "error_sessions">) =>
  row.sessions > 0 ? row.error_sessions / row.sessions : null;

export interface VersionSpike {
  version: string;
  rate: number;
  baseline: number;
  sessions: number;
  devices: number;
}

/**
 * The newest version, when its sessions hit errors clearly more often than the versions before it:
 * at least half as often again, and at least ten points more. `versions` is newest first.
 */
export function versionSpike(versions: readonly VersionSessions[]): VersionSpike | null {
  const [newest, ...earlier] = versions;
  if (!newest || newest.sessions < MIN_SESSIONS) return null;
  const before = earlier.reduce(
    (sum, row) => ({
      sessions: sum.sessions + row.sessions,
      errors: sum.errors + row.error_sessions,
    }),
    { sessions: 0, errors: 0 },
  );
  if (before.sessions < MIN_SESSIONS) return null;
  const rate = newest.error_sessions / newest.sessions;
  const baseline = before.errors / before.sessions;
  if (rate < baseline * 1.5 || rate - baseline < 0.1) return null;
  return {
    version: newest.version,
    rate,
    baseline,
    sessions: newest.sessions,
    devices: newest.devices,
  };
}
