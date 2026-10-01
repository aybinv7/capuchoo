import { isDroppedConnection, UploadTimeoutError } from "../utils/http.js";
import { confirmAfterTimeout, type RecoveryOptions } from "./upload-recovery.js";
import { uploadRelease, type UploadInput } from "./upload.js";

export interface Published {
  artefactId: string | null;
  /** Set when the upload timed out but the server turned out to have the artefact. */
  warning?: string;
}

/** An upload whose outcome is unknown: the version files must not be rewound. */
export class UnconfirmedUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnconfirmedUploadError";
  }
}

/**
 * Uploads, and after a timeout or a dropped connection asks the server whether the artefact landed before anyone
 * concludes it did not: rewinding the version of a release that exists makes the next deploy
 * collide with it.
 */
export async function publishRelease(
  input: UploadInput,
  recovery: RecoveryOptions = {},
): Promise<Published> {
  try {
    const { artefactId } = await uploadRelease(input);
    return { artefactId };
  } catch (error) {
    if (!(error instanceof UploadTimeoutError) && !isDroppedConnection(error)) throw error;
    const what =
      error instanceof UploadTimeoutError
        ? error.message
        : "The connection dropped during the upload";

    const label = `${input.artifact.kind === "ota" ? "Bundle" : "Native build"} ${input.outcome.version}`;
    const state = await confirmAfterTimeout(
      () => input.cloud.artefacts(input.cloudAppId),
      {
        kind: input.artifact.kind,
        platform: input.platform,
        flavour: input.outcome.environment,
        version: input.outcome.version,
        versionCode: input.outcome.versionCode,
      },
      recovery,
    );

    switch (state.kind) {
      case "published":
        return {
          artefactId: state.id,
          warning: `${what}, but the server has ${label}, so it was published. Check it with capuchoo release list.`,
        };
      case "absent":
        throw new Error(
          `${what}, and the server does not have ${label}. Nothing was published; deploy again.`,
          {
            cause: error,
          },
        );
      case "unknown":
        throw new UnconfirmedUploadError(
          `${what}, and the server could not be asked whether ${label} arrived (${state.reason}). ` +
            "The version files were kept; check capuchoo release list before deploying again.",
        );
    }
  }
}
