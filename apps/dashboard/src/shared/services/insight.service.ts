import { http } from "../api/http";
import { normalizeBuild, normalizeBuildDetail } from "../live/normalize";
import type { Build, BuildDetail } from "../types/build";
import type { AppStats } from "../types/stats";

export const fetchStats = (appId: string, days: number, signal?: AbortSignal) =>
  http.get<AppStats>(`/apps/${appId}/stats`, { days }, signal);

/** Top-level builds only: a CLI deploy inside a pipeline run is drawn under its run. */
export const fetchBuilds = (appId: string, limit = 50, signal?: AbortSignal) =>
  http
    .get<unknown[]>(`/apps/${appId}/builds`, { limit, scope: "top" }, signal)
    .then((rows) =>
      (Array.isArray(rows) ? rows : [])
        .map(normalizeBuild)
        .filter((build): build is Build => build !== null && !build.parent_id),
    );

function requireDetail(value: unknown): BuildDetail {
  const detail = normalizeBuildDetail(value);
  if (!detail) throw new Error("The server answered with something that is not a build.");
  return detail;
}

export const fetchBuild = (buildId: string, signal?: AbortSignal) =>
  http.get<unknown>(`/builds/${buildId}`, undefined, signal).then(requireDetail);

/** Reads the run back from its provider; the server allows one call per build every 10 s. */
export const syncBuild = (buildId: string) =>
  http.post<unknown>(`/builds/${buildId}/sync`).then(requireDetail);

export const cancelBuild = (buildId: string) =>
  http
    .post<{ build: unknown }>(`/builds/${buildId}/cancel`)
    .then((body) => normalizeBuild(body?.build));

export const rerunBuild = (buildId: string, failedOnly: boolean) =>
  http
    .post<{ build: unknown }>(`/builds/${buildId}/rerun`, { failed_only: failedOnly })
    .then((body) => normalizeBuild(body?.build));
