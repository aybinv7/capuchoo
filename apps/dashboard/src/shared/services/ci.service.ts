import type { CiRunRequest } from "@capuchoo/core";
import { http } from "../api/http";
import { normalizeBuild } from "../live/normalize";
import type { AppCi, CiRefs, CiRunCreated } from "../types/ci";

const ci = (appId: string) => `/apps/${appId}/ci`;

export const fetchAppCi = (appId: string, signal?: AbortSignal) =>
  http.get<AppCi>(ci(appId), undefined, signal);

export const fetchCiRefs = (appId: string, signal?: AbortSignal) =>
  http.get<CiRefs>(`${ci(appId)}/refs`, undefined, signal).then((refs) => ({
    default_branch: refs?.default_branch ?? "",
    branches: Array.isArray(refs?.branches) ? refs.branches : [],
    tags: Array.isArray(refs?.tags) ? refs.tags : [],
  }));

/**
 * Starts a run. The body is a validated `CiRunRequest`, with the wire's `build_type`. `build` is
 * null when the provider did not return the run's id; the stream announces it once it starts.
 */
export async function startCiRun(appId: string, request: CiRunRequest): Promise<CiRunCreated> {
  const { buildType, ...rest } = request;
  const body = await http.post<{ build: unknown; html_url?: string | null }>(`${ci(appId)}/runs`, {
    ...rest,
    build_type: buildType,
  });
  return { build: normalizeBuild(body?.build), html_url: body?.html_url ?? null };
}
