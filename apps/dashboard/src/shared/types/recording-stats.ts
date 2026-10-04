export interface RecordingDay {
  day: string;
  sessions: number;
  error_sessions: number;
  devices: number;
  bytes: number;
}

/** How one app version behaves on the devices that recorded it. */
export interface VersionQuality {
  version: string;
  sessions: number;
  error_sessions: number;
  devices: number;
  last_seen: string;
}

export type IssueStatus = "open" | "regressed" | "resolved";

export interface IssueSummary {
  id: string;
  message: string;
  frame: string | null;
  status: IssueStatus;
  first_seen: string;
  last_seen: string;
  /** Within the window. */
  occurrences: number;
  sessions: number;
  devices: number;
}

/** `GET /api/apps/:id/recording-stats?days=`. */
export interface RecordingStats {
  days: number;
  totals: {
    sessions: number;
    error_sessions: number;
    reports: number;
    devices: number;
    bytes: number;
    duration_ms: number;
    live_now: number;
    error_rate: number | null;
    avg_duration_ms: number | null;
  };
  daily: RecordingDay[];
  starts: Array<{ start: string; sessions: number }>;
  versions: VersionQuality[];
  issues: { open: number; regressed: number; new: number; top: IssueSummary[] };
  recorders: { total: number; online: number; degraded: number; live_rules: number };
}

/** A session as lists show it, without what only the player needs. */
export interface SessionSummary {
  id: string;
  device_uuid: string | null;
  device_id: string;
  version_name: string;
  channel: string | null;
  start: string;
  note: string | null;
  device: { model?: string | null; manufacturer?: string | null } | null;
  started_at: string;
  duration_ms: number;
  size_bytes: number;
  error_count: number;
  live: boolean;
}
