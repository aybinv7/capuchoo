import path from "node:path";
import type { DeployArtifact } from "../pipeline/deploy.js";
import { readApkCertificate } from "../pipeline/apk-certificate.js";
import type { AppArtefacts } from "../services/wire.js";
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
}

export interface Seal {
  /** Lowercase hex SHA-256 of the APK signing certificate; native only. */
  signingCertSha256?: string;
  warnings: string[];
}

/** Checks what was built against what devices already run, before anything is uploaded. */
export async function sealArtefact(input: SealInput): Promise<Seal> {
  const warnings: string[] = [];
  if (input.artifact.kind !== "native" || input.platform !== "android") return { warnings };

  const certificate = await readApkCertificate(
    input.artifact.filePath,
    path.resolve(input.androidDir),
    {
      logFile: input.logFile,
    },
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

  return {
    ...(certificate ? { signingCertSha256: certificate.sha256 } : {}),
    warnings,
  };
}
