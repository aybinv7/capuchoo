import type { CloudClient } from "../services/cloud.js";
import type { AppArtefacts } from "../services/wire.js";
import { HttpError } from "../utils/http.js";

/** The app's artefacts, or null when the server predates `GET /api/apps/:id/artefacts`. */
export async function loadArtefacts(
  cloud: CloudClient,
  cloudAppId: string,
): Promise<AppArtefacts | null> {
  try {
    return await cloud.artefacts(cloudAppId);
  } catch (error) {
    if (error instanceof HttpError && (error.status === 404 || error.status === 405)) return null;
    throw error;
  }
}
