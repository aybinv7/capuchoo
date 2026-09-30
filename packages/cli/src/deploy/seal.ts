import path from "node:path";
import type { DeployArtifact } from "../pipeline/deploy.js";
import { readApkCertificate } from "../pipeline/apk-certificate.js";
import type { AppArtefacts } from "../services/wire.js";
import type { ReleaseKey } from "../signing/release-key.js";
import { signReleaseFile } from "../signing/release-signature.js";
import type { ChannelClass } from "./channel-class.js";
import { checkCertificate, previousNativeRelease } from "./certificate-guard.js";

export interface SealInput {
  artifact: DeployArtifact;
  channel: ChannelClass;
  platform: "android" | "ios";
  androidDir: string;
  /** Null when the server could not list artefacts; the certificate is then read but not compared. */
  artefacts: AppArtefacts | null;
  allowCertChange: boolean;
  logFile: string;
  /** Null when no signing key is available; the release is then uploaded unsigned. */
  key: ReleaseKey | null;
  /** The app's primary bundle identifier, as signed. */
  appId: string;
  version: string;
  versionCode: number;
}

export interface Seal {
  /** Lowercase hex SHA-256 of the APK signing certificate; native only. */
  signingCertSha256?: string;
  /** base64url release signature, when a key was available. */
  signature?: string;
  sha256?: string;
  warnings: string[];
}

/** Whether a deploy has a `sign` step: a native Android certificate check, or a key to sign with. */
export function needsSeal(
  kind: "ota" | "native",
  platform: "android" | "ios",
  key: ReleaseKey | null,
): boolean {
  return key !== null || (kind === "native" && platform === "android");
}

async function checkApkCertificate(input: SealInput, warnings: string[]): Promise<string | null> {
  const certificate = await readApkCertificate(
    input.artifact.filePath,
    path.resolve(input.androidDir),
    { logFile: input.logFile },
  );

  const previous = input.artefacts
    ? previousNativeRelease(
        input.artefacts.native_builds,
        input.platform,
        input.channel.environment,
      )
    : null;

  const verdict = checkCertificate({
    channel: input.channel,
    current: certificate?.sha256 ?? null,
    previous,
    allowChange: input.allowCertChange,
  });

  if (!verdict.ok) throw new Error(verdict.message);
  if (verdict.warning) warnings.push(verdict.warning);
  if (!input.artefacts) {
    warnings.push(
      "The server could not list earlier releases, so the signing certificate was not compared.",
    );
  }
  return certificate?.sha256 ?? null;
}

/** Checks what was built against what devices already run, then signs it, before any upload. */
export async function sealArtefact(input: SealInput): Promise<Seal> {
  const warnings: string[] = [];
  const seal: Seal = { warnings };

  if (input.artifact.kind === "native" && input.platform === "android") {
    const certificate = await checkApkCertificate(input, warnings);
    if (certificate) seal.signingCertSha256 = certificate;
  }

  if (input.key) {
    const signed = await signReleaseFile(
      {
        kind: input.artifact.kind,
        appId: input.appId,
        platform: input.platform,
        version: input.version,
        versionCode: input.versionCode,
        file: input.artifact.filePath,
      },
      input.key,
    );
    seal.signature = signed.signature;
    seal.sha256 = signed.sha256;
  }

  return seal;
}
