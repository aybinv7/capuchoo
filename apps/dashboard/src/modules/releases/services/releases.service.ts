import { http } from "@/shared/api/http";
import type { Artefact, Bundle, NativeBuild } from "@/shared/types/release";
import type { ReleasePatch } from "../types/releases.types";

const collection = (kind: Artefact["kind"]) => (kind === "ota" ? "bundles" : "natives");

export function patchRelease(artefact: Artefact, patch: ReleasePatch): Promise<Artefact> {
  return artefact.kind === "ota"
    ? http.patch<Bundle>(`/bundles/${artefact.id}`, patch)
    : http.patch<NativeBuild>(`/natives/${artefact.id}`, patch);
}

export const deleteRelease = (artefact: Artefact) =>
  http.delete(`/${collection(artefact.kind)}/${artefact.id}`);

export const fetchDownloadLink = (artefact: Artefact) =>
  http.get<{ url: string; expires_in: number }>(
    `/${collection(artefact.kind)}/${artefact.id}/download`,
  );
