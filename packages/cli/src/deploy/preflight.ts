import type { UserProfile } from "@capuchoo/core";
import type { ResolvedFlavour } from "../pipeline/flavour.js";
import type { CloudClient } from "../services/cloud.js";
import type { AppArtefacts, AppRecord, ChannelRecord } from "../services/wire.js";
import { loadReleaseKey, PUBLIC_KEY_ENV, type ReleaseKey } from "../signing/release-key.js";
import { describeSigningProblems } from "../signing/signing-policy.js";
import { loadArtefacts } from "./artefact-index.js";

export interface PreflightInput {
  appDir: string;
  cloudAppId: string;
  kind: "ota" | "native";
  platform: "android" | "ios";
  channel: ChannelRecord;
  flavour: ResolvedFlavour;
  profile: UserProfile;
  cloud: CloudClient;
}

export interface Preflight {
  problems: string[];
  key: ReleaseKey | null;
  /** Earlier releases, fetched for native Android deploys; null when not needed or unsupported. */
  artefacts: AppArtefacts | null;
}

/** Release checks that need the server or the signing key; nothing here writes. */
export async function releasePreflight(input: PreflightInput): Promise<Preflight> {
  const problems: string[] = [];

  if (input.channel.kind === "client") {
    problems.push(
      `"${input.channel.name}" is a client channel: it takes no uploads and follows its base channel. ` +
        `Publish to the base channel, then run capuchoo channel point ${input.channel.name} --version <version>.`,
    );
  }

  let key: ReleaseKey | null = null;
  try {
    key = await loadReleaseKey(input.appDir);
  } catch (error) {
    problems.push(error instanceof Error ? error.message : String(error));
  }

  const app = input.profile.apps.find((row) => row.id === input.cloudAppId) as
    | AppRecord
    | undefined;

  problems.push(
    ...describeSigningProblems({
      channel: input.channel,
      key,
      requireSignature: app?.require_signature,
      serverPublicKey: app?.signing_public_key,
      flavourPublicKey: input.flavour.fileEnv[PUBLIC_KEY_ENV] || undefined,
      flavourFile: input.flavour.config.envFile,
    }),
  );

  const needsHistory = input.kind === "native" && input.platform === "android";
  const artefacts = needsHistory ? await loadArtefacts(input.cloud, input.cloudAppId) : null;

  return { problems, key, artefacts };
}
