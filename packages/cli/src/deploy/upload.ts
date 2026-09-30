import type { DeployArtifact, DeployOutcome } from "../pipeline/deploy.js";
import type { CloudClient } from "../services/cloud.js";
import type { UploadedArtefact } from "../services/wire.js";
import type { UploadResult } from "../utils/http.js";
import type { Seal } from "./seal.js";

export interface UploadInput {
  cloud: CloudClient;
  artifact: DeployArtifact;
  outcome: DeployOutcome;
  seal: Seal;
  cloudAppId: string;
  /** The app's primary bundle identifier. */
  appId: string;
  channel: string;
  platform: "android" | "ios";
  notes: string;
  active: boolean;
  required: boolean;
  minNative?: number | undefined;
  allowCertChange: boolean;
  buildId?: string | undefined;
}

export interface Uploaded {
  result: UploadResult;
  /** The artefact id the server assigned, when it said. */
  artefactId: string | null;
}

function artefactId(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const row = body as UploadedArtefact;
  return row.id ?? row.bundle_id ?? row.native_id ?? null;
}

/** Sends the artefact with everything that proves where it came from. */
export async function uploadRelease(input: UploadInput): Promise<Uploaded> {
  const common = {
    filePath: input.artifact.filePath,
    appId: input.appId,
    channel: input.channel,
    platform: input.platform,
    versionName: input.outcome.version,
    releaseNotes: input.notes,
    active: input.active,
    required: input.required,
    flavour: input.outcome.environment,
    signature: input.seal.signature,
    buildId: input.buildId,
  };

  const result =
    input.artifact.kind === "ota"
      ? await input.cloud.uploadBundle({
          ...common,
          ...(input.minNative === undefined ? {} : { minNativeVersion: String(input.minNative) }),
        })
      : await input.cloud.uploadNative({
          ...common,
          versionCode: input.outcome.versionCode,
          signingCertSha256: input.seal.signingCertSha256,
          allowCertChange: input.allowCertChange,
        });

  return { result, artefactId: artefactId(result.body) };
}
