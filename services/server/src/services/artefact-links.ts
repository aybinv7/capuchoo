import type { Deps } from "../http/context";
import { signArtefactPath } from "../storage/signed-url";

/** A downloadable URL for a stored artefact, valid for ARTEFACT_URL_TTL seconds. */
export async function artefactUrl(
  deps: Deps,
  baseUrl: string,
  storageKey: string,
): Promise<string> {
  const ttl = deps.config.ARTEFACT_URL_TTL;
  if (deps.storage.directUrl) return deps.storage.directUrl(storageKey, ttl);
  const path = signArtefactPath(
    deps.config.SECRET_KEY,
    storageKey,
    deps.now().getTime() + ttl * 1000,
  );
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}
