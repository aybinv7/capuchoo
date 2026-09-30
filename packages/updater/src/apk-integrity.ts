import type { ResolvedUpdate } from "@capuchoo/core";
import { hashCachedFile } from "./apk-hash.js";

/** The downloaded APK is not the one the server described. */
export class ApkIntegrityError extends Error {
  /** True when the file is known to be wrong and must be deleted. */
  readonly corrupt: boolean;

  constructor(message: string, corrupt: boolean) {
    super(message);
    this.name = "ApkIntegrityError";
    this.corrupt = corrupt;
  }
}

/** How far a cached APK was checked. `size-only` means its SHA-256 could not be. */
export type ApkIntegrity = "verified" | "size-only";

const SHA256_HEX = /^[0-9a-f]{64}$/i;

/**
 * Checks a cached APK against the SHA-256 the server published for it.
 *
 * With `requireHash` - set whenever the release must be signed, because the
 * signature covers the checksum and not the file - a missing checksum or an
 * unreadable file refuses the install. Without it, both fall back to the size
 * check the cache already performed, and say so in the log.
 *
 * @throws {ApkIntegrityError} on a mismatch, or when the hash is required and unobtainable.
 */
export async function checkApkIntegrity(
  update: ResolvedUpdate,
  fileName: string,
  options: { requireHash: boolean },
): Promise<ApkIntegrity> {
  const expected = update.checksum?.toLowerCase();

  if (!expected || !SHA256_HEX.test(expected)) {
    if (options.requireHash) {
      throw new ApkIntegrityError(
        `Version ${update.version} was published without a SHA-256 checksum, so it cannot be verified`,
        false,
      );
    }
    return "size-only";
  }

  const hash = await hashCachedFile(fileName);

  if (hash.kind === "unavailable") {
    if (options.requireHash) {
      throw new ApkIntegrityError(
        `The downloaded update could not be read to verify it (${hash.reason})`,
        false,
      );
    }
    console.warn("[capuchoo] APK checksum not verified, size check only:", hash.reason);
    return "size-only";
  }

  if (hash.sha256 !== expected) {
    throw new ApkIntegrityError(
      "The downloaded update is damaged or was altered in transit, so it was deleted. Download it again.",
      true,
    );
  }

  return "verified";
}
