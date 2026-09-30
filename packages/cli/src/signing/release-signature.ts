import { signRelease, type ReleaseKind } from "@capuchoo/core";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { pipeline } from "node:stream/promises";
import type { ReleaseKey } from "./release-key.js";

/** Lowercase hex SHA-256 of a file, streamed so a large APK is never held in memory. */
export async function sha256File(file: string): Promise<string> {
  const hash = createHash("sha256");
  await pipeline(fs.createReadStream(file), hash);
  return hash.digest("hex");
}

export interface ReleaseToSign {
  kind: ReleaseKind;
  /** The app's primary bundle identifier. */
  appId: string;
  platform: string;
  version: string;
  /** Native only. */
  versionCode?: number | undefined;
  file: string;
}

export interface SignedRelease {
  sha256: string;
  signature: string;
}

/** Hashes the artefact and signs the claim in docs/SERVER.md. */
export async function signReleaseFile(
  release: ReleaseToSign,
  key: ReleaseKey,
): Promise<SignedRelease> {
  const sha256 = await sha256File(release.file);
  const signature = await signRelease(
    {
      kind: release.kind,
      appId: release.appId,
      platform: release.platform,
      version: release.version,
      versionCode: release.kind === "native" ? release.versionCode : null,
      sha256,
    },
    key.privateKey,
  );
  return { sha256, signature };
}
