import { ENVIRONMENTS, type Environment } from "@capuchoo/core";
import fs from "node:fs";
import path from "node:path";
import { flavorApplicationId, type GradleAndroidProject } from "../pipeline/gradle-project.js";
import { loadReleaseKey } from "../signing/release-key.js";
import type { StepContext, StepOutcome } from "./steps.js";

/** The coordinates apps depend on, built by JitPack from the `android-v*` tags. */
export const ANDROID_LIBRARY = "com.github.aybinv7.capuchoo:capuchoo-android";
export const ANDROID_LIBRARY_VERSION = "android-v0.1.0";

export interface IdentifierPlan {
  bundleId: string;
  /** Null: every flavour ships under it. */
  flavour: Environment | null;
}

/**
 * What a Gradle app's devices will report as their package. A flavour named after an environment
 * with its own id claims that environment; without such flavours the default id is shared.
 */
export function planAndroidIdentifiers(project: GradleAndroidProject): IdentifierPlan[] {
  const claimed: IdentifierPlan[] = project.flavors
    .filter((flavor) => (ENVIRONMENTS as readonly string[]).includes(flavor.name))
    .flatMap((flavor) => {
      const bundleId = flavorApplicationId(project.applicationId, flavor);
      return bundleId ? [{ bundleId, flavour: flavor.name as Environment }] : [];
    });

  const distinct = new Set(claimed.map((plan) => plan.bundleId));
  if (claimed.length === 0 || distinct.size === 1)
    return project.applicationId ? [{ bundleId: project.applicationId, flavour: null }] : [];
  return claimed;
}

/** Gradle flavours named after an environment, as project.json's per-environment build choice. */
export function environmentFlavors(
  project: GradleAndroidProject,
): Partial<Record<Environment, { gradleFlavor: string }>> {
  return Object.fromEntries(
    project.flavors
      .filter((flavor) => (ENVIRONMENTS as readonly string[]).includes(flavor.name))
      .map((flavor) => [flavor.name, { gradleFlavor: flavor.name }]),
  );
}

export async function stepAndroidIdentifiers(
  ctx: StepContext,
  project: GradleAndroidProject,
): Promise<StepOutcome> {
  const plans = planAndroidIdentifiers(project);
  try {
    const existing = new Set(
      (await ctx.cloud.identifiers(ctx.cloudAppId)).map((row) => row.bundle_id),
    );
    const missing = plans.filter((plan) => !existing.has(plan.bundleId));
    if (missing.length === 0)
      return {
        id: "identifiers",
        state: "satisfied",
        detail: plans.map((plan) => plan.bundleId).join(", ") + " registered",
      };
    if (ctx.dryRun)
      return {
        id: "identifiers",
        state: "skipped",
        detail: `would register ${missing.map((plan) => plan.bundleId).join(", ")}`,
      };
    for (const plan of missing)
      await ctx.cloud.registerIdentifier(ctx.cloudAppId, {
        bundle_id: plan.bundleId,
        platform: "android",
        flavour: plan.flavour,
      });
    return {
      id: "identifiers",
      state: "applied",
      detail: missing
        .map((plan) => `${plan.bundleId} (${plan.flavour ?? "every flavour"})`)
        .join(", "),
    };
  } catch (error) {
    return {
      id: "identifiers",
      state: "failed",
      detail: `could not register: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function readFirst(dir: string, names: string[]): string {
  for (const name of names) {
    const file = path.join(dir, name);
    if (fs.existsSync(file)) return fs.readFileSync(file, "utf8");
  }
  return "";
}

/** Whether the module depends on the library and JitPack is a repository. Read, never edited. */
export function stepAndroidLibrary(root: string, project: GradleAndroidProject): StepOutcome {
  const build = readFirst(root, [project.buildFile]);
  const catalog = readFirst(root, ["gradle/libs.versions.toml"]);
  const repositories =
    readFirst(root, ["settings.gradle.kts", "settings.gradle"]) +
    readFirst(root, ["build.gradle.kts", "build.gradle"]);

  const depends =
    build.includes("capuchoo-android") ||
    (catalog.includes("capuchoo-android") && /capuchoo/i.test(build));
  const jitpack = repositories.includes("jitpack.io");
  if (depends && jitpack)
    return { id: "packages", state: "satisfied", detail: `${ANDROID_LIBRARY} from JitPack` };
  const missing = [!jitpack && "the JitPack repository", !depends && ANDROID_LIBRARY].filter(
    Boolean,
  );
  return { id: "packages", state: "skipped", detail: `add ${missing.join(" and ")} (below)` };
}

/** Whether some Kotlin or Java source starts the library. */
export function stepAndroidCode(root: string, project: GradleAndroidProject): StepOutcome {
  const sources = path.join(root, project.module, "src");
  const found = findInSources(sources, "Capuchoo.init(");
  return found
    ? {
        id: "code",
        state: "satisfied",
        detail: `Capuchoo.init in ${path.relative(root, found)}`,
      }
    : {
        id: "code",
        state: "skipped",
        detail: "call Capuchoo.init in Application.onCreate (below)",
      };
}

function findInSources(dir: string, needle: string, depth = 0): string | null {
  if (depth > 12 || !fs.existsSync(dir)) return null;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "build" || entry.name.startsWith(".")) continue;
      const found = findInSources(full, needle, depth + 1);
      if (found) return found;
    } else if (/\.(kt|java)$/.test(entry.name) && fs.readFileSync(full, "utf8").includes(needle)) {
      return full;
    }
  }
  return null;
}

/** The release key's public half, for the app to verify what it installs. */
export async function releasePublicKey(appDir: string): Promise<string | null> {
  try {
    return (await loadReleaseKey(appDir))?.publicKey ?? null;
  } catch {
    return null;
  }
}

/** The edits the library and code steps leave to the developer, filled with this app's values. */
export function describeAndroidWiring(input: {
  endpoint: string;
  publicKey: string | null;
  project: GradleAndroidProject;
  library: StepOutcome;
  code: StepOutcome;
}): string {
  const lines: string[] = [];
  const flavors = Object.keys(environmentFlavors(input.project)) as Environment[];

  if (input.library.state !== "satisfied") {
    lines.push(
      "  settings.gradle.kts, in dependencyResolutionManagement.repositories:",
      '      maven("https://jitpack.io")',
      "",
      `  ${input.project.buildFile}:`,
      `      implementation("${ANDROID_LIBRARY}:${ANDROID_LIBRARY_VERSION}")`,
      "",
    );
  }

  if (input.code.state !== "satisfied") {
    lines.push(
      `  ${input.project.buildFile}, in android { }:`,
      "      buildFeatures { buildConfig = true }",
      "      defaultConfig {",
      `          buildConfigField("String", "CAPUCHOO_ENDPOINT", "\\"${input.endpoint}\\"")`,
      `          buildConfigField("String", "CAPUCHOO_PUBLIC_KEY", "\\"${input.publicKey ?? "<run capuchoo keys init>"}\\"")`,
      ...(flavors.length === 0
        ? ['          buildConfigField("String", "CAPUCHOO_CHANNEL", "\\"prod\\"")']
        : []),
      "      }",
      ...flavors.map(
        (flavor) =>
          `      // productFlavors ${flavor}: buildConfigField("String", "CAPUCHOO_CHANNEL", "\\"${flavor}\\"")`,
      ),
      "",
      "  Application.onCreate:",
      "      Capuchoo.init(this, CapuchooConfig(",
      "          endpoint = BuildConfig.CAPUCHOO_ENDPOINT,",
      "          channel = BuildConfig.CAPUCHOO_CHANNEL,",
      "          publicKey = BuildConfig.CAPUCHOO_PUBLIC_KEY,",
      "      ))",
      "",
    );
  }

  return lines.join("\n");
}
