import { resolveSigning } from "./signing.js";
import { askText, confirm, isInteractive, selectOne, whileWaiting } from "../cli/prompts.js";
import type { Environment } from "@capuchoo/core";
import { Command, Flags } from "@oclif/core";
import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";
import type { ReleaseKey } from "../signing/release-key.js";
import { BuildTracker } from "./build-tracker.js";
import { detectCiContext } from "./ci-context.js";
import { loadArtefacts } from "./artefact-index.js";
import { describePrebuiltProblems } from "./prebuilt-apk.js";
import { isApkSigned } from "../pipeline/android.js";
import { readApkManifest, type ApkManifest } from "../pipeline/android-manifest.js";
import { readGradleVersion, type GradleVersion } from "../pipeline/gradle-deploy.js";
import { releasePreflight } from "./preflight.js";
import { needsSeal, sealArtefact, type Seal } from "./seal.js";
import { publishRelease, UnconfirmedUploadError } from "./publish.js";
import {
  DEPLOY_LOG_FILE,
  describeFailure,
  formatBytes,
  runDeploy,
  validateRequest,
  type DeployKind,
  type DeployOutcome,
  type DeployRequest,
} from "../pipeline/deploy.js";
import { resolveFlavour } from "../pipeline/flavour.js";
import { CloudClient } from "../services/cloud.js";
import {
  readAppVersion,
  requireProjectConfig,
  resolveCredentials,
  writeAppVersion,
} from "../utils/config.js";
import { Reporter } from "../utils/reporter.js";
import {
  describeTakenVersion,
  describeVersionRequestProblem,
  nextPublishedCode,
  publishedWebVersions,
  resolveReleaseVersion,
  type VersionRequest,
} from "./release-version.js";
import { uploadSourceMaps } from "./source-maps.js";
import { restoreVersionFiles, snapshotVersionFiles } from "./version-guard.js";
import { runnable } from "../cli/invocation.js";

/**
 * Shared implementation for `deploy ota` and `deploy native`.
 *
 * The two commands were previously separate 300-line files that differed in
 * about twenty lines. Every fix had to be applied twice, and in practice was
 * not: the OTA path never sent `version_code`, so the backend could not
 * evaluate a bundle's `min_update_version` gate for it, while the native path
 * did.
 */

/** Flags both deploy commands accept. */
export const commonDeployFlags = {
  channel: Flags.string({
    char: "c",
    description: "Channel to publish to. Its environment selects the flavour.",
  }),
  note: Flags.string({ char: "n", description: "Release notes shown to users" }),
  version: Flags.string({
    char: "v",
    description:
      "major, minor or patch bumps package.json; auto publishes a prerelease of the next patch on dev and staging and package.json as-is on prod; 1.2.3 or v1.2.3 publishes exactly that",
  }),
  active: Flags.boolean({
    char: "a",
    allowNo: true,
    description: "Serve this release immediately",
  }),
  required: Flags.boolean({
    char: "r",
    allowNo: true,
    description: "Users cannot postpone this release",
  }),
  "skip-assets": Flags.boolean({
    default: false,
    description: "Do not regenerate launcher icons",
  }),
  "skip-build": Flags.boolean({
    default: false,
    description: "Publish the existing build output as-is",
  }),
  "dry-run": Flags.boolean({
    default: false,
    description: "Build and package, but upload nothing",
  }),
  json: Flags.boolean({
    default: false,
    description: "Emit a machine-readable result on stdout",
  }),
  verbose: Flags.boolean({
    default: false,
    description: "Stream build output to the terminal",
  }),
  yes: Flags.boolean({
    char: "y",
    default: false,
    description: "Accept every prompt - required in CI",
  }),
  "allow-local-env": Flags.boolean({
    default: false,
    description:
      "Build prod even when .env / .env.local define VITE_* keys the flavour file does not, shipping this machine's values",
  }),
} as const;

export interface DeployFlags {
  channel?: string;
  note?: string;
  version?: string;
  active?: boolean;
  required?: boolean;
  "skip-assets": boolean;
  "skip-build": boolean;
  "dry-run": boolean;
  json: boolean;
  verbose: boolean;
  yes: boolean;
  platform?: string;
  type?: string;
  "allow-unsigned"?: boolean;
  "allow-cert-change"?: boolean;
  "allow-local-env": boolean;
  /** OTA only: the native build number a device needs before this bundle is served. */
  "min-native"?: number;
  /** Native only: publish this APK instead of building one. */
  apk?: string;
  flavor?: string;
}

export interface DeployCommandOptions {
  kind: DeployKind;
  command: Command;
  flags: DeployFlags;
}

/**
 * `Command#error` always throws at runtime, but its overload set resolves to
 * `void` when called with a bare string, so TypeScript does not narrow after a
 * call and every following access looks possibly-null. This restores the `never`
 * the runtime actually has.
 */
function fail(command: Command, message: string): never {
  command.error(message);
  throw new Error(message); // unreachable
}

interface Prebuilt {
  file: string;
  manifest: ApkManifest;
  signed: boolean;
}

/** Reads an APK built outside this CLI; the flags that would shape a build do not apply to it. */
function inspectPrebuilt(command: Command, flags: DeployFlags): Prebuilt {
  const file = path.resolve(flags.apk!);
  const ignored = [
    flags.version ? "--version" : null,
    flags.type ? "--type" : null,
    flags.flavor ? "--flavor" : null,
    flags["skip-build"] ? "--skip-build" : null,
  ].filter(Boolean);
  if (ignored.length > 0)
    fail(
      command,
      `--apk publishes the file as built, so ${ignored.join(", ")} cannot apply to it.`,
    );
  if (!fs.existsSync(file)) fail(command, `${flags.apk} does not exist.`);
  try {
    return { file, manifest: readApkManifest(file), signed: isApkSigned(file) };
  } catch (error) {
    return fail(command, error instanceof Error ? error.message : String(error));
  }
}

function prebuiltOutcome(
  prebuilt: Prebuilt,
  request: DeployRequest,
  reporter: Reporter,
): DeployOutcome {
  const byteSize = fs.statSync(prebuilt.file).size;
  reporter.plan([
    { id: "compile", label: "Reading the APK" },
    ...(request.seal ? [{ id: "sign" as const, label: "Checking and signing the artefact" }] : []),
    ...(request.dryRun ? [] : [{ id: "upload" as const, label: "Uploading to Capuchoo" }]),
  ]);
  reporter.begin("compile");
  reporter.note(
    `${prebuilt.manifest.applicationId} ${prebuilt.manifest.versionName} (build ${prebuilt.manifest.versionCode}), ` +
      `${formatBytes(byteSize)}${prebuilt.manifest.minSdk ? `, minSdk ${prebuilt.manifest.minSdk}` : ""}`,
  );
  return {
    version: prebuilt.manifest.versionName ?? "",
    versionCode: prebuilt.manifest.versionCode,
    environment: request.environment,
    artifact: { kind: "native", filePath: prebuilt.file, byteSize, signed: prebuilt.signed },
    nativeConfigMethod: "prebuilt",
    warnings: [],
    skipped: [{ step: "build", reason: "--apk" }],
  };
}

function describeSeal(seal: Seal, key: ReleaseKey | null): string {
  const parts = [
    seal.signingCertSha256 ? `certificate ${seal.signingCertSha256.slice(0, 16)}...` : null,
    key && seal.signature ? `signed with ${key.fingerprint}` : "not signed",
  ];
  return parts.filter(Boolean).join(", ");
}

export async function executeDeploy(options: DeployCommandOptions): Promise<void> {
  const { kind, command, flags } = options;
  const appDir = process.cwd();
  const json = flags.json;

  // In JSON mode stdout carries only the result document, so every human-facing
  // line goes to stderr. Non-interactive shells get the same treatment.
  let tracker = BuildTracker.disabled();
  const reporter = new Reporter({
    quiet: json || !process.stdout.isTTY,
    onStep: (id, status, message) => tracker.step(id, status, message),
  });

  const project = requireProjectConfig(appDir);
  const gradleOnly = project.runtime === "android";
  if (gradleOnly && kind === "ota")
    fail(
      command,
      "This is a native Android app, which has no web bundle to publish over the air. " +
        `Publish an APK with ${runnable("deploy native")}.`,
    );

  const credentials = resolveCredentials();
  if (!credentials) {
    fail(
      command,
      "Not authenticated. Run " +
        chalk.cyan(runnable(`auth login`)) +
        ", or set CAPUCHOO_ENDPOINT and CAPUCHOO_API_KEY.",
    );
  }

  const cloud = new CloudClient(credentials.endpoint, credentials.apiKey);
  // The backend sleeps when idle, so this first call can take fifteen seconds.
  // Unannounced, it looked like the CLI had hung before the deploy even started.
  const profile = await whileWaiting("Reaching the backend...", cloud.whoami());
  if (!profile) {
    fail(
      command,
      `The credentials for ${credentials.endpoint} were rejected. ` +
        (credentials.source === "environment"
          ? "Check CAPUCHOO_API_KEY."
          : `Run ${chalk.cyan(runnable(`auth login`))} again.`),
    );
  }

  if (!json) {
    command.log("");
    command.log(chalk.bold(`Capuchoo ${kind === "ota" ? "OTA" : "native"} deploy`));
    command.log(chalk.dim(`  app       ${project.appName} (${project.appId})`));
    command.log(chalk.dim(`  account   ${profile.user.email}`));
    command.log(chalk.dim(`  endpoint  ${credentials.endpoint}`));
    command.log("");
  }

  // --- channel, and therefore environment ------------------------------------

  let channelName = flags.channel;
  if (!channelName) {
    const channels = await cloud.channels(project.cloudAppId);
    const deployable = channels.filter((channel) => channel.environment);

    if (deployable.length === 0) {
      fail(
        command,
        "This app has no channel with an environment set. Run `capuchoo channel list` to see " +
          "what exists, then set an environment on one - it is what tells the CLI which " +
          "flavour to build.",
      );
    }

    // One channel is not a question, even under --yes or --json: there is
    // nothing to disambiguate.
    if (deployable.length === 1) {
      channelName = deployable[0]!.name;
    } else if (flags.yes || json || !isInteractive()) {
      fail(
        command,
        `--channel is required here. This app has ${deployable.length}: ` +
          deployable.map((c) => `${c.name} (${c.environment})`).join(", "),
      );
    } else {
      channelName = await selectOne(
        "Channel",
        deployable.map((channel) => ({
          value: channel.name,
          label: channel.name,
          hint: channel.environment,
        })),
        "--channel",
      );
    }
  }

  const channel = await cloud.requireChannel(project.cloudAppId, channelName);
  const environment: Environment = channel.environment;

  // Fetched so the preflight can check the flavour against what is registered
  // rather than against the spelling of the identifier. Left undefined on
  // failure - an older backend has no such endpoint, and treating that as "none
  // registered" would warn on every deploy.
  const identifiers = await cloud.identifiers(project.cloudAppId).catch(() => undefined);
  const artefacts = await loadArtefacts(cloud, project.cloudAppId);

  // --- release options -------------------------------------------------------

  // `isInteractive()` matters as much as the flags: without it a piped or CI
  // shell reaches a prompt nobody can answer and the deploy dies at the
  // question rather than doing the obvious thing.
  const interactive = !flags.yes && !json && isInteractive();

  const active =
    flags.active ?? (interactive ? await confirm("Serve immediately?", { default: true }) : true);
  const required =
    flags.required ??
    (interactive ? await confirm("Mark as required?", { default: false }) : false);

  const versionProblem = flags.version ? describeVersionRequestProblem(flags.version) : null;
  if (versionProblem) fail(command, versionProblem);

  const prebuilt = flags.apk ? inspectPrebuilt(command, flags) : null;
  const gradleDeclared = gradleOnly && !prebuilt ? readGradleVersion(appDir, project) : null;
  const currentVersion = (): string => {
    if (!gradleOnly) return readAppVersion(appDir);
    if (gradleDeclared) return gradleDeclared.name;
    return fail(
      command,
      `No versionName and versionCode in ${project.module}'s build file, so -v has nothing to start from.`,
    );
  };

  let requested = flags.version as VersionRequest | undefined;
  if (!requested && interactive && !prebuilt) {
    const answer = await selectOne<string>(
      "Bump the version?",
      [
        { value: "", label: "No bump", hint: `stay on ${currentVersion()}` },
        { value: "patch", label: "patch" },
        { value: "minor", label: "minor" },
        { value: "major", label: "major" },
        ...(environment === "prod"
          ? []
          : [{ value: "auto", label: "auto", hint: `next ${environment} prerelease` }]),
      ],
      "--version",
    );
    requested = answer === "" ? undefined : (answer as VersionRequest);
  }

  const note =
    flags.note ??
    (interactive
      ? await askText("Release notes", {
          placeholder: "Shown to users in the update prompt",
          flag: "--note",
          optional: true,
        })
      : "");

  const platform = (flags.platform ?? "android") as "android" | "ios";
  const resolution = prebuilt
    ? {
        version: prebuilt.manifest.versionName ?? "",
        origin: `from ${path.basename(prebuilt.file)}`,
      }
    : resolveReleaseVersion({
        current: currentVersion(),
        request: requested,
        environment,
        published: gradleOnly
          ? (artefacts?.native_builds ?? [])
              .filter((build) => build.platform === platform)
              .map((build) => build.version_name)
          : publishedWebVersions(artefacts, platform),
      });
  const version = resolution.version;
  const bump = requested !== undefined && requested !== "auto" && !gradleOnly;
  const gradleVersion: GradleVersion | undefined =
    gradleOnly && !prebuilt && requested
      ? {
          name: version,
          code: Math.max(
            nextPublishedCode(artefacts, platform, environment),
            (gradleDeclared?.code ?? 0) + 1,
          ),
        }
      : undefined;

  const signing = prebuilt
    ? {
        buildType: (prebuilt.manifest.debuggable ? "debug" : "release") as "debug" | "release",
        allowUnsigned: flags["allow-unsigned"] ?? false,
      }
    : await resolveSigning({
        appDir,
        kind,
        platform,
        channel,
        interactive,
        requested: flags.type as "debug" | "release" | undefined,
        allowUnsigned: flags["allow-unsigned"] ?? false,
      }).catch((error: unknown) =>
        fail(command, error instanceof Error ? error.message : String(error)),
      );

  if (!signing) {
    command.log(chalk.dim("Cancelled."));
    return;
  }

  const { buildType, allowUnsigned } = signing;

  // --- confirmation ----------------------------------------------------------

  if (interactive) {
    command.log("");
    command.log(chalk.dim("  ─────────────────────────────────────────"));
    command.log(`  channel      ${chalk.green(channel.name)} (${environment})`);
    command.log(
      `  version      ${chalk.green(version)}${prebuilt ? ` (build ${prebuilt.manifest.versionCode})` : ""}${resolution.origin ? chalk.dim(` (${resolution.origin})`) : ""}`,
    );
    if (kind === "native") {
      const signedNote =
        buildType === "debug"
          ? chalk.dim(" (debug-signed)")
          : allowUnsigned
            ? chalk.yellow(" (unsigned)")
            : "";
      command.log(`  platform     ${chalk.green(platform)} / ${buildType}${signedNote}`);
    }
    command.log(`  serve now    ${active ? chalk.green("yes") : "no"}`);
    command.log(`  required     ${required ? chalk.yellow("yes") : "no"}`);
    if (flags["dry-run"]) command.log(`  ${chalk.yellow("dry run - nothing is uploaded")}`);
    command.log(chalk.dim("  ─────────────────────────────────────────"));
    command.log("");

    const proceed = await confirm("Deploy?", { default: true });
    if (!proceed) {
      command.log(chalk.dim("Cancelled."));
      return;
    }
  }

  const request: DeployRequest = {
    appDir,
    project,
    kind,
    platform,
    channel: channel.name,
    environment,
    version,
    buildType,
    skipAssets: flags["skip-assets"],
    skipBuild: flags["skip-build"],
    allowUnsigned,
    flavor: flags.flavor,
    dryRun: flags["dry-run"],
    verbose: flags.verbose,
    quiet: json,
    identifiers,
    allowLocalEnv: flags["allow-local-env"],
    minVersionCode:
      kind === "native" ? nextPublishedCode(artefacts, platform, environment) : undefined,
    gradleVersion,
  };

  // Validated before package.json is written, not after.
  //
  // The bump used to happen first, so a deploy that could never have succeeded -
  // a flavour missing VITE_UPDATE_API_URL, say - still left the version
  // advanced. Three attempts took an app from 5.0.0 to 8.0.0 with nothing
  // published, and each one printed "package.json was already bumped" as if that
  // were acceptable. `validateRequest` reads files and does no work, so there is
  // no reason for it to run second. runDeploy checks again, for its other
  // callers.
  const flavour = resolveFlavour(appDir, project, environment);
  const preflight = await releasePreflight({
    appDir,
    cloudAppId: project.cloudAppId,
    kind,
    platform,
    channel,
    flavour,
    profile,
    artefacts,
  });
  request.seal = needsSeal(kind, platform, preflight.key);

  const taken = describeTakenVersion({ kind, version, platform, environment, artefacts });
  if (taken && flags["dry-run"])
    process.stderr.write(`${chalk.yellow("!")} ${taken} A real deploy stops here.\n`);
  const problems = [
    ...(prebuilt
      ? describePrebuiltProblems({
          file: path.basename(prebuilt.file),
          manifest: prebuilt.manifest,
          signed: prebuilt.signed,
          channel,
          identifiers,
          artefacts,
          allowUnsigned: flags["allow-unsigned"] ?? false,
        })
      : validateRequest(request, flavour)),
    ...preflight.problems,
    ...(taken && !flags["dry-run"] ? [taken] : []),
  ];
  if (problems.length > 0) {
    const detail = problems.map((problem) => `  - ${problem}`).join("\n");
    fail(command, `This deploy cannot proceed:\n${detail}\n\nNothing was changed.`);
  }

  // Read before anything is written, so a deploy that does not publish can put
  // the working tree back exactly as it was.
  const versionFiles = snapshotVersionFiles(appDir, project.versionCodeFile, project.androidDir);

  // Written before the build rather than after: an app may read its own
  // package.json version while building, and the restore on failure is what
  // makes writing early safe.
  if (bump) writeAppVersion(appDir, version);

  // Hoisted so the failure path can tell "nothing was published, put it back"
  // from "it published, and the files have to stay".
  let uploaded = false;
  let publishedId: string | null = null;

  if (!flags["dry-run"]) {
    tracker = BuildTracker.start(cloud, project.cloudAppId, {
      kind,
      channel: channel.name,
      version,
      ...detectCiContext(),
    });
  }

  try {
    const outcome = prebuilt
      ? prebuiltOutcome(prebuilt, request, reporter)
      : await runDeploy(request, reporter);
    const artifact = outcome.artifact;
    if (!artifact) throw new Error("The pipeline produced no artefact");

    if (gradleOnly && !prebuilt) {
      const built = describePrebuiltProblems({
        file: path.basename(artifact.filePath),
        manifest: readApkManifest(artifact.filePath),
        signed: artifact.signed ?? false,
        channel,
        identifiers,
        artefacts,
        allowUnsigned,
      });
      if (built.length > 0)
        throw new Error(`The built APK cannot be published:\n  - ${built.join("\n  - ")}`);
    }

    let seal: Seal = { warnings: [] };
    if (request.seal) {
      reporter.begin("sign");
      seal = await sealArtefact({
        artifact,
        channel,
        platform,
        androidDir: path.resolve(appDir, project.androidDir),
        artefacts: preflight.artefacts,
        allowCertChange: flags["allow-cert-change"] ?? false,
        logFile: path.join(appDir, DEPLOY_LOG_FILE),
        key: preflight.key,
        appId: project.appId,
        version: outcome.version,
        versionCode: outcome.versionCode,
      });
      reporter.note(describeSeal(seal, preflight.key));
      outcome.warnings.push(...seal.warnings);
    }

    if (!flags["dry-run"]) {
      reporter.begin("upload");

      const published = await publishRelease({
        cloud,
        artifact,
        outcome,
        seal,
        cloudAppId: project.cloudAppId,
        appId: project.appId,
        channel: channel.name,
        platform,
        notes: note ?? "",
        active,
        required,
        minNative: flags["min-native"],
        allowCertChange: flags["allow-cert-change"] ?? false,
        buildId: await tracker.buildId(),
      });

      uploaded = true;
      publishedId = published.artefactId;
      reporter.note(`${formatBytes(artifact.byteSize)} accepted`);
      if (published.warning) outcome.warnings.push(published.warning);

      if (artifact.sourceMaps?.length) {
        const maps = await uploadSourceMaps({
          cloud,
          cloudAppId: project.cloudAppId,
          versionName: outcome.version,
          maps: artifact.sourceMaps,
        });
        if (maps.uploaded) reporter.note(`${maps.uploaded} source maps stored for stack traces`);
        if (maps.failed.length) {
          outcome.warnings.push(
            `${maps.failed.length} source maps were not stored, so their stacks stay minified: ` +
              maps.failed.map((entry) => `${entry.path} (${entry.reason})`).join(", "),
          );
        }
      }

      // The OTA archive is a build artefact; the APK is not - it may be needed
      // for a store submission, so it stays.
      if (uploaded && kind === "ota") {
        fs.rmSync(artifact.filePath, { force: true });
      }
    }

    reporter.finish(
      flags["dry-run"]
        ? `Dry run complete - v${outcome.version} was built but not uploaded`
        : `v${outcome.version} published to "${channel.name}"`,
    );
    await tracker.finish({
      status: "succeeded",
      ...(publishedId ? { [kind === "ota" ? "bundle_id" : "native_id"]: publishedId } : {}),
    });

    for (const warning of outcome.warnings) {
      process.stderr.write(`${chalk.yellow("!")} ${warning}\n`);
    }

    if (json) {
      // stdout carries the result document and nothing else.
      command.log(
        JSON.stringify(
          {
            ok: true,
            kind,
            version: outcome.version,
            versionCode: outcome.versionCode,
            channel: channel.name,
            environment: outcome.environment,
            platform,
            uploaded,
            dryRun: flags["dry-run"],
            artifact: {
              path: flags["dry-run"] ? artifact.filePath : undefined,
              bytes: artifact.byteSize,
              files: artifact.fileCount,
              signed: artifact.signed,
              releaseSignature: Boolean(seal.signature),
              signingCertSha256: seal.signingCertSha256,
            },
            nativeConfig: outcome.nativeConfigMethod,
            skipped: outcome.skipped,
            warnings: outcome.warnings,
          },
          null,
          2,
        ),
      );
    }
  } catch (error) {
    const message = describeFailure(error, appDir);
    reporter.fail("Deploy failed", message);
    await tracker.finish({ status: "failed", error: message });

    if (uploaded) {
      // Published, so the files must stay: the version on disk is the version
      // that now exists on the server, and rewinding it would make the next
      // deploy publish the same one again.
      process.stderr.write(
        chalk.yellow(
          `\n! ${version} was published before this failed, so the version files ` +
            "were left as they are.\n",
        ),
      );
    } else if (error instanceof UnconfirmedUploadError) {
      process.stderr.write(chalk.yellow("\n! The version files were kept.\n"));
    } else {
      // Nothing was published, so nothing should have changed. Done here rather
      // than by telling the operator to run git checkout: a tool that knows it
      // left a file wrong should put it back, and that message was easy to miss
      // under a wall of build errors.
      const restored = restoreVersionFiles(versionFiles);

      if (restored.length > 0) {
        process.stderr.write(
          chalk.dim(
            `\n  Nothing was published, so ${restored.join(" and ")} ` +
              `${restored.length === 1 ? "was" : "were"} restored.\n`,
          ),
        );
      }
    }

    if (json) {
      command.log(JSON.stringify({ ok: false, error: message }, null, 2));
      process.exitCode = 1;
      return;
    }

    command.error(message);
  }
}
