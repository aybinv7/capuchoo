import { verifyRelease, type ReleaseClaim, type ResolvedUpdate } from "@capuchoo/core";
import type { UpdaterConfig } from "./config.js";

/** An update whose origin could not be proven, and which was therefore not applied. */
export class ReleaseVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReleaseVerificationError";
  }
}

export type SignatureVerdict = "verified" | "unchecked";

/** The claim the server signed for this update, as `releaseSignaturePayload` expects it. */
export function releaseClaim(
  update: ResolvedUpdate,
  context: { appId: string; platform: string },
): ReleaseClaim {
  return {
    kind: update.kind,
    appId: update.appId || context.appId,
    platform: update.platform ?? context.platform,
    version: update.version,
    versionCode: update.kind === "native" ? (update.versionCode ?? null) : null,
    sha256: (update.checksum ?? "").toLowerCase(),
  };
}

/**
 * Proves an update was signed by the key baked into this build, before
 * anything is applied or installed.
 *
 * A signature that is present is always checked, even when signatures are not
 * required: a bad one is worse than none. Without a key, or with no signature
 * and signatures optional, the update is `unchecked`.
 *
 * @throws {ReleaseVerificationError} when verification is required and fails.
 */
export async function verifyUpdateSignature(
  update: ResolvedUpdate,
  config: Pick<UpdaterConfig, "publicKey" | "requireSignature" | "appId">,
  platform: string,
): Promise<SignatureVerdict> {
  const { publicKey, requireSignature } = config;

  if (!publicKey) {
    if (requireSignature) {
      throw new ReleaseVerificationError(
        "This build requires signed updates but carries no public key to check them with",
      );
    }
    return "unchecked";
  }

  if (!update.signature) {
    if (requireSignature) {
      throw new ReleaseVerificationError(
        `Version ${update.version} is not signed, so it was not installed`,
      );
    }
    return "unchecked";
  }

  const claim = releaseClaim(update, { appId: config.appId, platform });
  const valid = await verifyRelease(claim, update.signature, publicKey);
  if (!valid) {
    throw new ReleaseVerificationError(
      `Version ${update.version} failed its signature check, so it was not installed`,
    );
  }
  return "verified";
}
