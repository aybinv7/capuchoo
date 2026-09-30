import { http } from "../api/http";
import type { Build, BuildDetail } from "../types/build";
import type { AppStats } from "../types/stats";

export const fetchStats = (appId: string, days: number, signal?: AbortSignal) =>
  http.get<AppStats>(`/apps/${appId}/stats`, { days }, signal);

export const fetchBuilds = (appId: string, limit = 50, signal?: AbortSignal) =>
  http.get<Build[]>(`/apps/${appId}/builds`, { limit }, signal);

export const fetchBuild = (buildId: string, signal?: AbortSignal) =>
  http.get<BuildDetail>(`/builds/${buildId}`, undefined, signal);
