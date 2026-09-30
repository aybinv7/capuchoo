import type { Environment, Platform } from "@capuchoo/core";
import type { NativeArtefact } from "../services/wire.js";
import { describeChannel, isProtectedChannel, type ChannelClass } from "./channel-class.js";

export interface CertificateFacts {
  channel: ChannelClass;
  /** Digest of the APK just built, or null when no tool could read it. */
  current: string | null;
  /** The newest earlier native release of the same flavour and platform, or null. */
  previous: NativeArtefact | null;
  /** `--allow-cert-change`. */
  allowChange: boolean;
}

export type CertificateVerdict = { ok: true; warning?: string } | { ok: false; message: string };

function short(digest: string): string {
  return `${digest.slice(0, 16)}...`;
}

/** The release a new APK has to be able to upgrade: highest build number, same flavour and platform. */
export function previousNativeRelease(
  builds: NativeArtefact[],
  platform: Platform,
  flavour: Environment,
): NativeArtefact | null {
  let newest: NativeArtefact | null = null;
  for (const build of builds) {
    if (build.platform !== platform || build.flavour !== flavour) continue;
    if (!newest || build.version_code > newest.version_code) newest = build;
  }
  return newest;
}

/**
 * Android installs an update only when its signing certificate matches the installed one, so a
 * changed certificate strands every device on the previous build. Pure over the facts.
 */
export function checkCertificate(facts: CertificateFacts): CertificateVerdict {
  const { channel, current, previous, allowChange } = facts;
  const target = describeChannel(channel);

  if (!current) {
    const message =
      "The APK signing certificate could not be read (apksigner from the Android build-tools, or keytool from the JDK).";
    return isProtectedChannel(channel)
      ? { ok: false, message: `${message} It is required before publishing to ${target}.` }
      : { ok: true, warning: `${message} The certificate was not checked.` };
  }

  const pinned = previous?.signing_cert_sha256?.toLowerCase();
  if (!previous || !pinned || pinned === current) return { ok: true };

  const detail =
    `This APK is signed with ${short(current)}, but ${previous.version_name} (build ${previous.version_code}) ` +
    `was signed with ${short(pinned)}. Devices running it cannot install this update.`;

  if (allowChange) {
    return { ok: true, warning: `${detail} Published anyway because of --allow-cert-change.` };
  }

  return {
    ok: false,
    message: `${detail}\n  Sign with the original keystore, or pass --allow-cert-change if every device will be reinstalled.`,
  };
}
