import fs from "node:fs";
import path from "node:path";
import { gradleString, parseFlavorBlocks } from "./gradle-variant.js";

export interface GradleFlavor {
  name: string;
  /** The flavour's own `applicationId`, which replaces the default one. */
  applicationId: string | null;
  applicationIdSuffix: string | null;
}

/** An Android application built by Gradle alone: Kotlin, Java or a Kotlin Multiplatform module. */
export interface GradleAndroidProject {
  /** The Gradle module that applies the Android application plugin, e.g. `app` or `composeApp`. */
  module: string;
  /** Relative to the project root. */
  buildFile: string;
  applicationId: string | null;
  flavors: GradleFlavor[];
  /** `app_name` from the module's default strings, when it is a plain string. */
  appName: string | null;
}

const SETTINGS = ["settings.gradle.kts", "settings.gradle"];
const BUILD_FILES = ["build.gradle.kts", "build.gradle"];
const APPLICATION_PLUGIN =
  /com\.android\.application|plugins\.android\.application|\bandroid\.application\b|androidApplication/;

function read(file: string): string | null {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
}

/** Modules a settings file includes, as directory paths: `:app` -> `app`, `:feature:x` -> `feature/x`. */
export function includedModules(settings: string): string[] {
  const modules = new Set<string>();
  for (const call of settings.matchAll(/\binclude\s*\(?([^)\n]*)\)?/g)) {
    for (const name of call[1]!.matchAll(/["']:?([\w:.-]+)["']/g))
      modules.add(name[1]!.replace(/:/g, "/"));
  }
  return [...modules];
}

/** The application id a flavour builds under, given the module's default. */
export function flavorApplicationId(base: string | null, flavor: GradleFlavor): string | null {
  if (flavor.applicationId) return flavor.applicationId;
  if (!base) return null;
  return flavor.applicationIdSuffix ? `${base}${flavor.applicationIdSuffix}` : base;
}

/**
 * The Gradle Android application at `root`, or null when there is none or when this is a Capacitor
 * project, whose Android half is generated and driven from the web side.
 */
export function detectGradleAndroidProject(root: string): GradleAndroidProject | null {
  if (
    ["capacitor.config.ts", "capacitor.config.js", "capacitor.config.json"].some((name) =>
      fs.existsSync(path.join(root, name)),
    )
  )
    return null;

  const settings = SETTINGS.map((name) => read(path.join(root, name))).find(Boolean);
  if (!settings) return null;

  const candidates = ["app", ...includedModules(settings).filter((module) => module !== "app")];
  for (const module of candidates) {
    for (const name of BUILD_FILES) {
      const buildFile = path.join(module, name);
      const gradle = read(path.join(root, buildFile));
      if (!gradle || !APPLICATION_PLUGIN.test(gradle)) continue;

      const defaultConfig = /\bdefaultConfig\s*\{[\s\S]*?\n\s*\}/.exec(gradle)?.[0] ?? gradle;
      return {
        module,
        buildFile: buildFile.replace(/\\/g, "/"),
        applicationId:
          gradleString(defaultConfig, "applicationId") ?? gradleString(gradle, "namespace"),
        flavors: parseFlavorBlocks(gradle).map((block) => ({
          name: block.name,
          applicationId: gradleString(block.body, "applicationId"),
          applicationIdSuffix: gradleString(block.body, "applicationIdSuffix"),
        })),
        appName: readAppName(path.join(root, module)),
      };
    }
  }
  return null;
}

function readAppName(moduleDir: string): string | null {
  const strings =
    read(path.join(moduleDir, "src/main/res/values/strings.xml")) ??
    read(path.join(moduleDir, "src/androidMain/res/values/strings.xml"));
  const value = strings
    ? /<string\s+name="app_name"[^>]*>([^<]+)<\/string>/.exec(strings)?.[1]
    : null;
  return value && !value.startsWith("@") ? value.trim() : null;
}
