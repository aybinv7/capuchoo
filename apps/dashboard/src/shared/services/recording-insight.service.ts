import { http } from "../api/http";
import type { RecordingStats, SessionSummary } from "../types/recording-stats";

export const fetchRecordingStats = (appId: string, days: number, signal?: AbortSignal) =>
  http.get<RecordingStats>(`/apps/${appId}/recording-stats`, { days }, signal);

/** The newest stored sessions of an app, or of one device. */
export const fetchLatestSessions = (
  appId: string,
  options: { limit: number; deviceId?: string },
  signal?: AbortSignal,
) =>
  http
    .get<{ sessions: SessionSummary[] }>(
      `/apps/${appId}/recordings`,
      { limit: options.limit, ...(options.deviceId ? { device_id: options.deviceId } : {}) },
      signal,
    )
    .then((body) => body.sessions ?? []);
