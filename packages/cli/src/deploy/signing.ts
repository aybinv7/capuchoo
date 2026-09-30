import fs from "node:fs";
import path from "node:path";
import {
  describeSigning,
  inspectReleaseSigning,
  type SigningStatus,
} from "../pipeline/android-signing.js";
import { log, selectOne, type Choice } from "../cli/prompts.js";
import {
  describeChannel,
  isDevChannel,
  isProtectedChannel,
  type ChannelClass,
} from "./channel-class.js";

export interface SigningChoice {
  buildType: "debug" | "release";
  allowUnsigned: boolean;
}

export interface SigningFacts {
  kind: "ota" | "native";
  platform: "android" | "ios";
  channel: ChannelClass;
  interactive: boolean;
  /** `--type`; undefined when the operator did not choose. */
  requested?: "debug" | "release" | undefined;
  /** `--allow-unsigned`. */
  allowUnsigned: boolean;
  /** Release signing state of the Android project, or null when there is none. */
  state: SigningStatus | null;
}

export type SigningDecision =
  | { kind: "build"; choice: SigningChoice; warning?: string }
  | { kind: "ask"; problem: string; choices: Choice<SigningChoice | null>[] }
  | { kind: "refuse"; message: string };

export interface SigningInput extends Omit<SigningFacts, "state"> {
  appDir: string;
}

/** Reads the project's release signing state, or null when there is no Android project. */
export function androidSigningState(appDir: string): SigningStatus | null {
  const gradlePath = path.join(appDir, "android", "app", "build.gradle");
  if (!fs.existsSync(gradlePath)) return null;

  const propertiesPath = path.join(appDir, "android", "local.properties");

  return inspectReleaseSigning({
    buildGradle: fs.readFileSync(gradlePath, "utf8"),
    localProperties: fs.existsSync(propertiesPath) ? fs.readFileSync(propertiesPath, "utf8") : "",
  });
}

const DEBUG: SigningChoice = { buildType: "debug", allowUnsigned: false };
const RELEASE: SigningChoice = { buildType: "release", allowUnsigned: false };
const UNSIGNED: SigningChoice = { buildType: "release", allowUnsigned: true };

const FIX_SIGNING =
  "Fill in the release signing values (android/local.properties locally, the keystore variables in CI) and deploy again.";

/**
 * Decides what to build, pure over the facts.
 *
 * A debug-signed or unsigned APK cannot upgrade a release install, so on a protected channel it
 * strands every field device on its current build; those cases are refusals, never fallbacks.
 */
export function decideSigning(facts: SigningFacts): SigningDecision {
  const { channel, requested, allowUnsigned, state } = facts;

  if (facts.kind !== "native" || facts.platform !== "android") {
    return { kind: "build", choice: { buildType: requested ?? "release", allowUnsigned } };
  }

  const target = describeChannel(channel);

  if (allowUnsigned && !isDevChannel(channel)) {
    return {
      kind: "refuse",
      message: `--allow-unsigned only publishes to dev channels, and ${target} is not one. An unsigned APK does not install.`,
    };
  }

  if (requested === "debug") {
    if (isProtectedChannel(channel)) {
      return {
        kind: "refuse",
        message: `A debug-signed APK cannot upgrade a release install, so it is never published to ${target}. Build --type release.`,
      };
    }
    return { kind: "build", choice: DEBUG };
  }

  if (allowUnsigned) return { kind: "build", choice: UNSIGNED };
  if (!state || state.kind === "ready") return { kind: "build", choice: RELEASE };

  const problem = describeSigning(state);

  if (requested === "release") {
    return {
      kind: "refuse",
      message: `Release signing is not ready: ${problem}\n  ${FIX_SIGNING}`,
    };
  }

  if (isProtectedChannel(channel)) {
    return {
      kind: "refuse",
      message: `Release signing is not ready, and ${target} only takes release-signed APKs: ${problem}\n  ${FIX_SIGNING}`,
    };
  }

  if (!facts.interactive) {
    return {
      kind: "build",
      choice: DEBUG,
      warning: `Release signing is not ready: ${problem} Building debug for ${target}.`,
    };
  }

  const choices: Choice<SigningChoice | null>[] = [
    { value: DEBUG, label: "Debug", hint: "signed with the debug key, installs anywhere" },
    ...(isDevChannel(channel)
      ? [
          {
            value: UNSIGNED,
            label: "Release, unsigned",
            hint: "sign it yourself before installing",
          },
        ]
      : []),
    { value: null, label: "Cancel", hint: "fill in the keystore first" },
  ];

  return { kind: "ask", problem, choices };
}

/** Applies `decideSigning`, prompting when it asks. Returns null when the operator cancels. */
export async function resolveSigning(input: SigningInput): Promise<SigningChoice | null> {
  const state =
    input.kind === "native" && input.platform === "android"
      ? androidSigningState(input.appDir)
      : null;
  const decision = decideSigning({ ...input, state });

  switch (decision.kind) {
    case "refuse":
      throw new Error(decision.message);
    case "build":
      if (decision.warning) log.warn(decision.warning);
      return decision.choice;
    case "ask":
      log.warn(`Release signing is not ready: ${decision.problem}`);
      return selectOne("How should this be built?", decision.choices, "--type");
  }
}
