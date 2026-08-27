import { resolveSigning } from "./signing.js";
import { askText, confirm, isInteractive, selectOne, whileWaiting } from "../cli/prompts.js";
import { bumpVersion, type BumpType, type Environment } from "@capuchoo/core";
import { Command, Flags } from "@oclif/core";
import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";
import {
  describeFailure,
  formatBytes,
  runDeploy,
  type DeployKind,
  type DeployRequest,
} from "../pipeline/deploy.js";
import { CloudClient } from "../services/cloud.js";
import {
  readAppVersion,
  requireProjectConfig,
  resolveCredentials,
  writeAppVersion,
} from "../utils/config.js";
import { Reporter } from "../utils/reporter.js";

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
    description: "Bump the app version before publishing",
    options: ["major", "minor", "patch"],
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

export async function executeDeploy(options: DeployCommandOptions): Promise<void> {
  const { kind, command, flags } = options;
  const appDir = process.cwd();
  const json = flags.json;

  // In JSON mode stdout carries only the result document, so every human-facing
  // line goes to stderr. Non-interactive shells get the same treatment.
  const reporter = new Reporter({ quiet: json || !process.stdout.isTTY });

  const project = requireProjectConfig(appDir);

  const credentials = resolveCredentials();
  if (!credentials) {
    fail(
      command,
      "Not authenticated. Run " +
        chalk.cyan("capuchoo auth login") +
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
          : `Run ${chalk.cyan("capuchoo auth login")} again.`),
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

  let bump = flags.version as BumpType | undefined;
  if (!bump && interactive) {
    const answer = await selectOne<string>(
      "Bump the version?",
      [
        { value: "", label: "No bump", hint: `stay on ${readAppVersion(appDir)}` },
        { value: "patch", label: "patch" },
        { value: "minor", label: "minor" },
        { value: "major", label: "major" },
      ],
      "--version",
    );
    bump = answer === "" ? undefined : (answer as BumpType);
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

  const currentVersion = readAppVersion(appDir);
  const version = bump ? bumpVersion(currentVersion, bump) : currentVersion;

  const platform = (flags.platform ?? "android") as "android" | "ios";

  const signing = await resolveSigning({
    appDir,
    kind,
    platform,
    interactive,
    requested: flags.type as "debug" | "release" | undefined,
    allowUnsigned: flags["allow-unsigned"] ?? false,
  });

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
      `  version      ${chalk.green(version)}${bump ? chalk.dim(` (${bump} from ${currentVersion})`) : ""}`,
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

  // The version is written only after confirmation, so an abandoned prompt
  // leaves package.json untouched.
  if (bump) writeAppVersion(appDir, version);

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
  };

  try {
    const outcome = await runDeploy(request, reporter);
    const artifact = outcome.artifact;
    if (!artifact) throw new Error("The pipeline produced no artefact");

    let uploaded = false;

    if (!flags["dry-run"]) {
      reporter.begin("upload");

      const result =
        kind === "ota"
          ? await cloud.uploadBundle({
              filePath: artifact.filePath,
              appId: project.appId,
              channel: channel.name,
              platform,
              versionName: outcome.version,
              releaseNotes: note ?? "",
              active,
              required,
              flavour: environment,
            })
          : await cloud.uploadNative({
              filePath: artifact.filePath,
              appId: project.appId,
              channel: channel.name,
              platform,
              versionName: outcome.version,
              versionCode: outcome.versionCode,
              releaseNotes: note ?? "",
              active,
              required,
              flavour: environment,
            });

      uploaded = result.status >= 200 && result.status < 300;
      reporter.note(`${formatBytes(artifact.byteSize)} accepted`);

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
    reporter.fail("Deploy failed");

    if (json) {
      command.log(JSON.stringify({ ok: false, error: message }, null, 2));
      process.exitCode = 1;
      return;
    }

    if (bump) {
      // Say so explicitly: the file on disk no longer matches what is
      // published, and a silent mismatch is how a version gets skipped.
      process.stderr.write(
        chalk.yellow(
          `\n! package.json was already bumped to ${version}. ` +
            `Revert it with: git checkout -- ${path.join(".", "package.json")}\n`,
        ),
      );
    }

    command.error(message);
  }
}
