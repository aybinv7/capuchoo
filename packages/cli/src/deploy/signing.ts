import fs from "node:fs";
import path from "node:path";
import { inspectReleaseSigning } from "../pipeline/android-signing.js";
import { log, selectOne } from "../cli/prompts.js";

export interface SigningChoice {
  buildType: "debug" | "release";
  allowUnsigned: boolean;
}

export interface SigningInput {
  appDir: string;
  kind: "ota" | "native";
  platform: "android" | "ios";
  interactive: boolean;
  /** `--type`, which wins over any prompt. */
  requested?: "debug" | "release" | undefined;
  /** `--allow-unsigned`. */
  allowUnsigned: boolean;
}

/** Reads the project's release signing state, or null when there is no Android project. */
export function androidSigningState(appDir: string) {
  const gradlePath = path.join(appDir, "android", "app", "build.gradle");
  if (!fs.existsSync(gradlePath)) return null;

  const propertiesPath = path.join(appDir, "android", "local.properties");

  return inspectReleaseSigning({
    buildGradle: fs.readFileSync(gradlePath, "utf8"),
    localProperties: fs.existsSync(propertiesPath) ? fs.readFileSync(propertiesPath, "utf8") : "",
  });
}

/**
 * Decides what to build and whether an unsigned release is acceptable.
 *
 * Only asks when a release build would fail for want of a keystore. Returns null
 * when the user cancels.
 */
export async function resolveSigning(input: SigningInput): Promise<SigningChoice | null> {
  const { appDir, kind, platform, interactive, requested, allowUnsigned } = input;

  if (kind !== "native" || platform !== "android") {
    return { buildType: requested ?? "release", allowUnsigned };
  }

  const state = androidSigningState(appDir);

  if (requested === "debug") return { buildType: "debug", allowUnsigned };
  if (allowUnsigned) return { buildType: requested ?? "release", allowUnsigned: true };
  if (!state || state.kind === "ready") {
    return { buildType: requested ?? "release", allowUnsigned: false };
  }

  const problem =
    state.kind === "unconfigured"
      ? `signingConfigs.${state.configName} needs ${state.missing.join(", ")} in android/local.properties`
      : "the release build type declares no signingConfig";

  if (!interactive) {
    log.warn(`Release signing is not ready: ${problem}. Building debug instead.`);
    return { buildType: "debug", allowUnsigned: false };
  }

  log.warn(`Release signing is not ready: ${problem}.`);

  return selectOne<SigningChoice | null>(
    "How should this be built?",
    [
      {
        value: { buildType: "debug", allowUnsigned: false },
        label: "Debug",
        hint: "signed with the debug key, installs anywhere",
      },
      {
        value: { buildType: "release", allowUnsigned: true },
        label: "Release, unsigned",
        hint: "sign it yourself before distributing",
      },
      { value: null, label: "Cancel", hint: "fill in the keystore first" },
    ],
    "--type debug or --allow-unsigned",
  );
}
