import { pemBody, type ResolvedProjectConfig } from "@capuchoo/core";
import fs from "node:fs";
import path from "node:path";
import { parseEnvFile } from "../pipeline/flavour.js";
import { PUBLIC_KEY_ENV } from "./release-key.js";

export type FlavourKeyState = "matches" | "missing" | "different" | "no-file";

export interface FlavourKeyReport {
  environment: string;
  envFile: string;
  state: FlavourKeyState;
}

/** Whether each flavour file bakes the given public key into its build. */
export function flavourKeyReport(
  appDir: string,
  project: ResolvedProjectConfig,
  publicKey: string,
): FlavourKeyReport[] {
  return Object.entries(project.flavours).map(([environment, flavour]) => {
    const file = path.resolve(appDir, flavour.envFile);
    if (!fs.existsSync(file)) return { environment, envFile: flavour.envFile, state: "no-file" };

    const baked = parseEnvFile(fs.readFileSync(file, "utf8"))[PUBLIC_KEY_ENV];
    const state: FlavourKeyState = !baked
      ? "missing"
      : pemBody(baked) === pemBody(publicKey)
        ? "matches"
        : "different";
    return { environment, envFile: flavour.envFile, state };
  });
}

export function publicKeyLine(publicKey: string): string {
  return `${PUBLIC_KEY_ENV}=${publicKey}`;
}
