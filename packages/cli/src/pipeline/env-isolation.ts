import { versionEnv } from "@capuchoo/core";
import fs from "node:fs";
import path from "node:path";
import { DEPLOY_ONLY_ENV, parseEnvFile, type ResolvedFlavour } from "./flavour.js";

/** Keys the CLI always passes itself, so a local file can never supply them. */
const CLI_OWNED_KEYS: ReadonlySet<string> = new Set([
  ...Object.keys(versionEnv("0.0.0", 0)),
  ...Object.keys(DEPLOY_ONLY_ENV),
]);

/** Keys read only while live reload is on, which every deploy forces off. */
const INERT_PREFIXES = ["VITE_LIVE_RELOAD_"] as const;

const isIgnored = (key: string) =>
  CLI_OWNED_KEYS.has(key) || INERT_PREFIXES.some((prefix) => key.startsWith(prefix));

export interface LocalEnvSource {
  /** Relative to the directory it was found in, for messages. */
  label: string;
  keys: string[];
}

export interface LeakedKey {
  key: string;
  files: string[];
}

/** The dotenv files Vite loads for a mode, in the order it loads them. */
export function localEnvFileNames(mode: string): string[] {
  return [".env", ".env.local", `.env.${mode}`, `.env.${mode}.local`];
}

/**
 * Reads every dotenv file Vite would merge into the build from `roots`, except the flavour file
 * itself. Keys only: values are never needed and never logged.
 */
export function readLocalEnvSources(roots: string[], flavour: ResolvedFlavour): LocalEnvSource[] {
  const flavourFile = flavour.envFile ? path.resolve(flavour.envFile) : null;
  const seen = new Set<string>();
  const sources: LocalEnvSource[] = [];

  for (const root of roots) {
    for (const name of localEnvFileNames(flavour.mode)) {
      const file = path.resolve(root, name);
      if (seen.has(file) || file === flavourFile) continue;
      seen.add(file);
      if (!fs.existsSync(file)) continue;

      const keys = Object.keys(parseEnvFile(fs.readFileSync(file, "utf8")));
      const label =
        roots.length > 1 && root !== roots[0] ? path.join(path.basename(root), name) : name;
      sources.push({ label, keys });
    }
  }

  return sources;
}

/** `VITE_*` keys a local file defines that the flavour file does not, so the local value would ship. */
export function findLeakedKeys(
  flavourEnv: Record<string, string>,
  sources: LocalEnvSource[],
): LeakedKey[] {
  const leaked = new Map<string, string[]>();

  for (const source of sources) {
    for (const key of source.keys) {
      if (!key.startsWith("VITE_") || key in flavourEnv || isIgnored(key)) continue;
      leaked.set(key, [...(leaked.get(key) ?? []), source.label]);
    }
  }

  return [...leaked]
    .map(([key, files]) => ({ key, files }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

/** `requiredEnv` keys the flavour file omits or leaves empty. */
export function missingRequiredKeys(
  required: readonly string[],
  flavourEnv: Record<string, string>,
): string[] {
  return required.filter((key) => !flavourEnv[key]);
}

export interface EnvIsolationFacts {
  envFileLabel: string;
  required: readonly string[];
  flavourEnv: Record<string, string>;
  sources: LocalEnvSource[];
  allowLocalEnv: boolean;
  /** A production flavour: a local value reaching every installed device is refused, not warned. */
  strict: boolean;
}

export interface EnvIsolation {
  problems: string[];
  warnings: string[];
}

/** What makes a flavour's build depend on the machine running it: refused, or said out loud. */
export function assessEnvIsolation(facts: EnvIsolationFacts): EnvIsolation {
  const problems: string[] = [];
  const warnings: string[] = [];

  const missing = missingRequiredKeys(facts.required, facts.flavourEnv);
  if (missing.length > 0) {
    problems.push(
      `${facts.envFileLabel} does not set ${missing.join(", ")}, which project.json lists in requiredEnv`,
    );
  }

  const leaked = facts.allowLocalEnv ? [] : findLeakedKeys(facts.flavourEnv, facts.sources);
  if (leaked.length > 0) {
    const list = leaked.map((entry) => `${entry.key} (${entry.files.join(", ")})`).join(", ");
    if (facts.strict)
      problems.push(
        `These keys would be filled from this machine's env files because ${facts.envFileLabel} does not set them: ${list}. ` +
          `Set them in ${facts.envFileLabel}, or pass --allow-local-env to accept the local values`,
      );
    else
      warnings.push(
        `${list} come from this machine's env files, because ${facts.envFileLabel} does not set them. ` +
          `Another machine or CI builds this flavour differently; a prod deploy refuses it`,
      );
  }

  return { problems, warnings };
}
