import {
  environmentFromAppId,
  type Environment,
  type ResolvedProjectConfig,
} from "@capucho/core";
import fs from "node:fs";
import path from "node:path";
import { CommandError, type RunOptions } from "../utils/exec.js";
import { Reporter, type Step } from "../utils/reporter.js";
import {
  assembleAndroid,
  collectAndroidArtifact,
  type BuildType,
} from "./android.js";
import { buildWeb, generateAssets, syncCapacitor, type StepContext } from "./build.js";
import {
  buildEnvironment,
  describeFlavourProblems,
  resolveFlavour,
  resolveVersionState,
  writeVersionCodes,
  type ResolvedFlavour,
  type VersionState,
} from "./flavour.js";
import { applyNativeConfig, builtinConfigLimitations } from "./native-config.js";
import { detectToolchain } from "./toolchain.js";
import { bundleFileName, createBundleZip } from "./zip.js";

/**
 * The deploy pipeline.
 *
 * One code path for OTA and native deploys, and one place where the step list
 * is decided. The steps that will run are computed *before* anything executes,
 * which is what makes the progress numbers true and lets the whole thing be
 * validated with `--dry-run` without touching the project.
 */

export type DeployKind = "ota" | "native";
export type Platform = "android" | "ios";

export interface DeployRequest {
  appDir: string;
  project: ResolvedProjectConfig;
  kind: DeployKind;
  platform: Platform;
  channel: string;
  environment: Environment;
  /** Semantic version being published, already bumped if requested. */
  version: string;
  buildType: BuildType;
  skipAssets: boolean;
  skipBuild: boolean;
  allowUnsigned: boolean;
  dryRun: boolean;
  verbose: boolean;
  quiet: boolean;
}

export interface DeployArtifact {
  kind: DeployKind;
  filePath: string;
  byteSize: number;
  /** Native only. */
  signed?: boolean;
  /** OTA only. */
  fileCount?: number;
}

export interface DeployOutcome {
  version: string;
  versionCode: number;
  environment: Environment;
  artifact: DeployArtifact | null;
  nativeConfigMethod: string;
  warnings: string[];
  /** Steps that were planned but skipped, with reasons. */
  skipped: Array<{ step: string; reason: string }>;
}

const LOG_FILE = "capucho-deploy.log";

/**
 * Builds the step list for a request.
 *
 * Conditional work is resolved here rather than inside the run loop, so a
 * skipped step never leaves a gap in the numbering.
 */
export function planSteps(request: DeployRequest): Step[] {
  const steps: Step[] = [{ id: "resolve", label: "Resolving flavour and version" }];

  if (!request.skipBuild) {
    if (!request.skipAssets) {
      steps.push({ id: "assets", label: "Generating launcher assets" });
    }
    steps.push({ id: "web", label: "Building web assets" });
    steps.push({ id: "native-config", label: "Applying native configuration" });
    steps.push({ id: "sync", label: "Syncing Capacitor" });
  }

  steps.push(
    request.kind === "ota"
      ? { id: "bundle", label: "Packaging OTA bundle" }
      : { id: "compile", label: `Compiling ${request.platform} (${request.buildType})` },
  );

  if (!request.dryRun) {
    steps.push({ id: "upload", label: "Uploading to Capucho" });
  }

  return steps;
}

/**
 * Checks the request against the project before any work happens.
 *
 * Cheap validation up front matters more than it sounds: the old pipeline
 * bumped the version in `package.json` as step 1, then discovered a missing env
 * file at step 2, leaving the repository holding a version that was never
 * published.
 */
export function validateRequest(
  request: DeployRequest,
  flavour: ResolvedFlavour,
): string[] {
  const problems = describeFlavourProblems(flavour);

  const declaredAppId = flavour.fileEnv.VITE_APP_ID;
  if (declaredAppId) {
    const expected = environmentFromAppId(declaredAppId);
    if (expected !== request.environment) {
      // The backend enforces this too and answers "Environment mismatch",
      // which is a confusing thing to discover after a 40 MB upload.
      problems.push(
        `Channel "${request.channel}" serves the ${request.environment} environment, but ` +
          `${flavour.config.envFile} declares VITE_APP_ID=${declaredAppId}, which is a ` +
          `${expected} bundle id. The server will refuse this pairing.`,
      );
    }
  }

  if (request.kind === "native" && request.platform === "ios") {
    problems.push(
      "iOS native builds are not driven by this CLI yet - archive and upload " +
        "through Xcode, then register the build in the dashboard.",
    );
  }

  const webDir = path.resolve(request.appDir, request.project.webDir);
  if (request.skipBuild && !fs.existsSync(webDir)) {
    problems.push(
      `--skip-build was passed but ${request.project.webDir} does not exist, ` +
        "so there is nothing to publish.",
    );
  }

  return problems;
}

export async function runDeploy(
  request: DeployRequest,
  reporter: Reporter,
): Promise<DeployOutcome> {
  const warnings: string[] = [];
  const skipped: Array<{ step: string; reason: string }> = [];

  const toolchain = detectToolchain(request.appDir);
  const flavour = resolveFlavour(request.appDir, request.project, request.environment);

  const problems = validateRequest(request, flavour);
  if (problems.length > 0) {
    throw new Error(`This deploy cannot proceed:\n  - ${problems.join("\n  - ")}`);
  }

  reporter.plan(planSteps(request));

  // Only a native build changes the installed binary, so only a native build
  // needs a new versionCode.
  const state: VersionState = resolveVersionState(
    request.appDir,
    request.project,
    request.environment,
    request.version,
    request.kind === "native",
  );

  const env = buildEnvironment(flavour, state);
  const runOptions: Omit<RunOptions, "cwd" | "env"> = {
    logFile: path.join(request.appDir, LOG_FILE),
    verbose: request.verbose,
  };
  const context: StepContext = { toolchain, flavour, env, runOptions };

  reporter.begin("resolve");
  reporter.note(
    `${request.environment} flavour, v${state.version} (build ${state.versionCode}), ` +
      `${toolchain.packageManager} workspace`,
  );

  let nativeConfigMethod = "not run";

  if (!request.skipBuild) {
    if (!request.skipAssets) {
      reporter.begin("assets");
      const outcome = await generateAssets(context, request.platform);
      if (!outcome.ran) {
        reporter.skip(outcome.reason);
        skipped.push({ step: "assets", reason: outcome.reason });
      }
    }

    reporter.begin("web");
    const web = await buildWeb(context, request.project.build);
    if (web.ran) reporter.note(web.via);

    reporter.begin("native-config");
    const nativeConfig = await applyNativeConfig({
      appDir: request.appDir,
      androidDir: request.project.androidDir,
      iosDir: request.project.iosDir,
      flavour,
      env,
      platform: request.platform,
      runOptions,
    });
    nativeConfigMethod = nativeConfig.method;

    if (nativeConfig.method === "trapeze") {
      reporter.note("Trapeze applied the flavour configuration");
    } else {
      reporter.note(
        `Built-in configuration (${nativeConfig.reason}): ` +
          `${nativeConfig.changed.length} file(s) updated`,
      );
      for (const limitation of builtinConfigLimitations(request.platform)) {
        warnings.push(limitation);
      }
    }

    reporter.begin("sync");
    const sync = await syncCapacitor(context, request.platform);
    if (!sync.ran) {
      reporter.skip(sync.reason);
      skipped.push({ step: "sync", reason: sync.reason });
      warnings.push(
        "Capacitor sync did not run, so the native project may still hold the " +
          "previous build's web assets",
      );
    }
  } else {
    skipped.push({ step: "build", reason: "--skip-build" });
  }

  let artifact: DeployArtifact | null = null;

  if (request.kind === "ota") {
    reporter.begin("bundle");
    const webDir = path.resolve(request.appDir, request.project.webDir);
    const outFile = path.join(
      request.appDir,
      bundleFileName(request.project.appId, state.version),
    );
    const bundle = createBundleZip({ webDir, outFile });
    reporter.note(
      `${bundle.fileCount} files, ${formatBytes(bundle.byteSize)} -> ${path.basename(bundle.zipPath)}`,
    );
    artifact = {
      kind: "ota",
      filePath: bundle.zipPath,
      byteSize: bundle.byteSize,
      fileCount: bundle.fileCount,
    };
  } else {
    reporter.begin("compile");
    const androidDir = path.resolve(request.appDir, request.project.androidDir);
    await assembleAndroid(androidDir, request.buildType, runOptions);
    const built = collectAndroidArtifact(
      androidDir,
      request.buildType,
      request.allowUnsigned,
    );
    reporter.note(
      `${path.basename(built.apkPath)}, ${formatBytes(built.byteSize)}` +
        (built.signed ? "" : " (unsigned)"),
    );
    if (!built.signed) {
      warnings.push(
        "This artefact is not signed. Android will not install it as-is.",
      );
    }
    artifact = {
      kind: "native",
      filePath: built.apkPath,
      byteSize: built.byteSize,
      signed: built.signed,
    };
  }

  // The version code is persisted only once the artefact exists, so a failed
  // build does not consume a build number.
  if (request.kind === "native" && !request.dryRun) {
    writeVersionCodes(request.appDir, request.project, state.codes);
  }

  return {
    version: state.version,
    versionCode: state.versionCode,
    environment: request.environment,
    artifact,
    nativeConfigMethod,
    warnings,
    skipped,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

/** Turns a pipeline failure into something worth printing. */
export function describeFailure(error: unknown, appDir: string): string {
  if (error instanceof CommandError) {
    return (
      `${error.message}\n\n  Full output: ${path.join(appDir, LOG_FILE)}`
    );
  }
  return error instanceof Error ? error.message : String(error);
}
