import fs from "node:fs";
import path from "node:path";
import type { ResolvedProjectConfig } from "@capuchoo/core";
import type { RunOptions } from "../utils/exec.js";
import type { Reporter } from "../utils/reporter.js";
import { assembleAndroid, collectAndroidArtifact, readProductFlavors } from "./android.js";
import { readApkManifest } from "./android-manifest.js";
import type { DeployOutcome, DeployRequest } from "./deploy.js";
import { chooseFlavor, describeAmbiguousFlavor, gradleString } from "./gradle-variant.js";

/** The Gradle properties a deploy passes when it chooses the version itself. */
export const VERSION_NAME_PROPERTY = "capuchoo.versionName";
export const VERSION_CODE_PROPERTY = "capuchoo.versionCode";

export interface GradleVersion {
  name: string;
  code: number;
}

/** The version the module's build file declares, as the starting point of a bump. */
export function readGradleVersion(
  appDir: string,
  project: ResolvedProjectConfig,
): GradleVersion | null {
  for (const name of ["build.gradle.kts", "build.gradle"]) {
    const file = path.join(appDir, project.androidDir, project.module, name);
    if (!fs.existsSync(file)) continue;
    const gradle = fs.readFileSync(file, "utf8");
    const versionName = gradleString(gradle, "versionName");
    const versionCode = /\bversionCode\s*=?\s*(\d+)/.exec(gradle)?.[1];
    return versionName && versionCode ? { name: versionName, code: Number(versionCode) } : null;
  }
  return null;
}

/** What to add when the build ignored the version the deploy asked for. */
export function describeIgnoredVersion(wanted: GradleVersion, built: GradleVersion): string {
  return (
    `The APK was built as ${built.name} (${built.code}), not ${wanted.name} (${wanted.code}): ` +
    "the Gradle build does not read the version a deploy passes. In defaultConfig:\n\n" +
    `    versionCode = (findProperty("${VERSION_CODE_PROPERTY}") as String?)?.toInt() ?: ${built.code}\n` +
    `    versionName = findProperty("${VERSION_NAME_PROPERTY}") as String? ?: "${built.name}"\n\n` +
    "Or deploy without -v, and the version in the build file is published as it is."
  );
}

/**
 * A native deploy of a Gradle-only app: one variant, built with the app's own wrapper, and
 * described by the manifest of the APK it produced rather than by anything the CLI assumed.
 */
export async function runGradleDeploy(
  request: DeployRequest,
  reporter: Reporter,
  runOptions: Omit<RunOptions, "cwd" | "env">,
): Promise<DeployOutcome> {
  const { project } = request;
  const androidDir = path.resolve(request.appDir, project.androidDir);
  const declared = project.flavours[request.environment].gradleFlavor;
  const choice = chooseFlavor({
    flavors: readProductFlavors(androidDir, project.module),
    requested: request.flavor ?? declared,
    environment: request.environment,
  });
  if (choice.kind === "ambiguous")
    throw new Error(describeAmbiguousFlavor(choice.flavors, request.environment));
  const flavor = choice.kind === "chosen" ? choice.flavor : undefined;

  reporter.begin("resolve");
  reporter.note(
    `${request.environment} environment, module ${project.module}` +
      (flavor ? `, flavour ${flavor}` : "") +
      (request.gradleVersion
        ? `, v${request.gradleVersion.name} (build ${request.gradleVersion.code})`
        : ""),
  );

  reporter.begin("compile");
  const properties = request.gradleVersion
    ? {
        [VERSION_NAME_PROPERTY]: request.gradleVersion.name,
        [VERSION_CODE_PROPERTY]: String(request.gradleVersion.code),
      }
    : undefined;
  await assembleAndroid(androidDir, request.buildType, runOptions, flavor, {
    module: project.module,
    ...(properties ? { properties } : {}),
  });
  const built = collectAndroidArtifact(
    androidDir,
    request.buildType,
    request.allowUnsigned,
    flavor,
    project.module,
  );

  const manifest = readApkManifest(built.apkPath);
  const version = { name: manifest.versionName ?? "", code: manifest.versionCode };
  const wanted = request.gradleVersion;
  if (wanted && (version.name !== wanted.name || version.code !== wanted.code))
    throw new Error(describeIgnoredVersion(wanted, version));

  reporter.note(
    `${path.basename(built.apkPath)}: ${manifest.applicationId} ${version.name} (build ${version.code})` +
      (built.signed ? "" : ", unsigned"),
  );

  return {
    version: version.name,
    versionCode: version.code,
    environment: request.environment,
    artifact: {
      kind: "native",
      filePath: built.apkPath,
      byteSize: built.byteSize,
      signed: built.signed,
    },
    nativeConfigMethod: "gradle",
    warnings: built.signed
      ? []
      : ["This artefact is not signed. Android will not install it as-is."],
    skipped: [],
  };
}
