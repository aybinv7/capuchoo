import {
  canPublishTo,
  hasEnvironmentMismatch,
  normaliseProjectConfig,
  suggestEnvironment,
  type Environment,
} from "@capuchoo/core";
import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";
import { whileWaiting } from "../cli/prompts.js";
import { BaseCommand } from "../base-command.js";
import { describeSigning, inspectReleaseSigning } from "../pipeline/android-signing.js";
import { CloudClient } from "../services/cloud.js";
import { readProjectConfig, resolveCredentials } from "../utils/config.js";

type Level = "ok" | "warn" | "fail";

interface Finding {
  level: Level;
  what: string;
  detail?: string;
  /** The command or edit that resolves it. Every non-ok finding must have one. */
  fix?: string;
}

/**
 * Explains why a deploy will not work, before you run one.
 *
 * Every check here corresponds to something that has silently failed in this
 * project: an endpoint pointing at a retired backend, a channel whose
 * environment disagreed with its name, a channel serving nothing because the
 * upload never moved its pointer, an app whose flavour env file did not exist.
 * Each finding names the fix, because a diagnosis you cannot act on is just bad
 * news.
 */
export default class Doctor extends BaseCommand {
  static override description = "Check that this app, its credentials and its channels are usable";

  static override examples = ["<%= config.bin %> doctor"];

  async run(): Promise<void> {
    const appDir = process.cwd();
    const findings: Finding[] = [];

    // --- credentials ---------------------------------------------------------

    const credentials = resolveCredentials();
    if (!credentials) {
      this.report([{ level: "fail", what: "Not signed in", fix: "capuchoo auth login" }]);
      return;
    }

    findings.push({ level: "ok", what: "Endpoint", detail: credentials.endpoint });

    const cloud = new CloudClient(credentials.endpoint, credentials.apiKey);

    // Unreachable and rejected are different problems with different fixes, and
    // conflating them is worse than saying nothing. This reported "Credentials
    // rejected - the endpoint did not accept the stored API key" for a backend
    // that was merely asleep: the key was valid, the very next run proved it,
    // and the message had sent someone looking at credentials with confidence.
    let profile;
    try {
      profile = await whileWaiting("Reaching the backend...", cloud.whoami());
    } catch (error) {
      findings.push({
        level: "fail",
        what: "The backend could not be reached",
        detail: `${credentials.endpoint} - ${error instanceof Error ? error.message : String(error)}`,
        fix:
          "Check the endpoint and the connection, then run doctor again. A host " +
          "that sleeps when idle can time out on its first request and answer the second.",
      });
      this.report(findings);
      return;
    }

    if (!profile) {
      findings.push({
        level: "fail",
        what: "Credentials rejected",
        detail: `${credentials.endpoint} answered, and refused the stored API key`,
        fix: `capuchoo auth login   (or capuchoo config set endpoint <url>)`,
      });
      this.report(findings);
      return;
    }

    findings.push({ level: "ok", what: "Signed in", detail: profile.user.email });

    // --- the link between this directory and a cloud app ---------------------

    // Normalised, not raw: a v1 project.json carries only the cloud identifiers
    // and every flavour is defaulted at runtime. Reading the raw fields reported
    // "no flavour configured" for an app that deploys fine.
    const raw = readProjectConfig(appDir);
    const project = raw ? normaliseProjectConfig(raw) : null;
    if (!project) {
      findings.push({
        level: "fail",
        what: "This directory is not linked to an app",
        fix: "capuchoo init",
      });
      this.report(findings);
      return;
    }

    findings.push({
      level: "ok",
      what: "Linked",
      detail: `${project.appName} (${project.appId})`,
    });

    // An app-scoped key lists every app the account owns and is refused only by
    // the endpoints that publish - so without this check the first sign of a
    // mismatch is a 403 at step 7 of 7, after a full build and zip.
    const outOfScope = !canPublishTo(profile, project.cloudAppId);

    if (outOfScope) {
      const scoped = profile.apps.find((app) => app.id === profile.credential?.app_id);
      findings.push({
        level: "fail",
        what: "This API key cannot publish to this app",
        detail: scoped
          ? `The key is restricted to ${scoped.name} (${scoped.app_id})`
          : `The key is restricted to app ${profile.credential?.app_id}`,
        fix: "capuchoo auth login   (with a key for this app, or an unscoped one)",
      });
    }

    // --- channels ------------------------------------------------------------

    const channels = await whileWaiting(
      "Reading channels...",
      cloud.channels(project.cloudAppId),
    ).catch(() => null);

    if (!channels) {
      // An out-of-scope key is refused by this endpoint too, and blaming the app
      // for that is a second wrong diagnosis on top of a correct one: doctor
      // reported "deleted, or belongs to another account" for an app that exists
      // and is fine, one line after correctly saying the key was for another app.
      findings.push(
        outOfScope
          ? {
              level: "fail",
              what: "This app's channels could not be read",
              detail: "The same key restriction reported above also blocks reading them",
              fix: "capuchoo auth login   (with a key for this app, or an unscoped one)",
            }
          : {
              level: "fail",
              what: "The linked cloud app could not be read",
              detail: `cloudAppId ${project.cloudAppId} - deleted, or belongs to another account`,
              fix: "capuchoo init --force",
            },
      );
      this.report(findings);
      return;
    }

    if (channels.length === 0) {
      findings.push({
        level: "fail",
        what: "No channels",
        detail: "Nothing can be deployed until a channel exists",
        fix: "capuchoo channel create staging",
      });
    }

    for (const channel of channels) {
      if (!channel.environment) {
        findings.push({
          level: "fail",
          what: `Channel "${channel.name}" has no environment`,
          detail: "The environment is what tells the CLI which flavour to build",
          fix:
            "Recreate it with capuchoo channel create, or set the environment " +
            `in the dashboard (suggested: ${suggestEnvironment(channel.name) ?? "prod"})`,
        });
        continue;
      }

      if (hasEnvironmentMismatch(channel.name, channel.environment)) {
        findings.push({
          level: "warn",
          what: `Channel "${channel.name}" is on the ${channel.environment} environment`,
          detail: `Devices on it receive ${channel.environment} bundles, built from .env.${channel.environment}`,
          fix: `Set it to ${suggestEnvironment(channel.name)} unless that is deliberate`,
        });
      }

      // The pointer that decides what is served. An upload that does not move
      // it leaves the channel answering "no update" forever.
      if (!channel.current_version_id) {
        findings.push({
          level: "warn",
          what: `Channel "${channel.name}" is serving no bundle`,
          detail: "No OTA version is active on it yet",
          fix: `capuchoo deploy ota --channel ${channel.name}`,
        });
      }
    }

    // --- flavours ------------------------------------------------------------

    const environments = new Set<Environment>(
      channels.map((channel) => channel.environment).filter(Boolean) as Environment[],
    );

    for (const environment of environments) {
      const flavour = project.flavours[environment];

      const envFile = path.join(appDir, flavour.envFile);
      if (!fs.existsSync(envFile)) {
        findings.push({
          level: "fail",
          what: `Missing ${flavour.envFile}`,
          detail: `A ${environment} deploy reads it for the app id, version and update URL`,
          fix: `Create ${flavour.envFile}`,
        });
        continue;
      }

      const contents = fs.readFileSync(envFile, "utf8");
      const updateUrl = /^VITE_UPDATE_API_URL=(.*)$/m.exec(contents)?.[1]?.trim();

      if (!updateUrl) {
        findings.push({
          level: "fail",
          what: `${flavour.envFile} has no VITE_UPDATE_API_URL`,
          detail: "The app would ship with updates silently disabled",
          fix: `Add VITE_UPDATE_API_URL=${credentials.endpoint}`,
        });
      } else if (updateUrl.replace(/\/+$/, "") !== credentials.endpoint.replace(/\/+$/, "")) {
        // Not necessarily wrong - a custom domain in front of the same service
        // is good practice - but it is the mistake that cost an afternoon.
        findings.push({
          level: "warn",
          what: `${flavour.envFile} points at a different host`,
          detail: `app: ${updateUrl}   cli: ${credentials.endpoint}`,
          fix: "Confirm both reach the same backend",
        });
      } else {
        findings.push({ level: "ok", what: `Flavour ${environment}`, detail: flavour.envFile });
      }
    }

    // --- the app's own wiring ------------------------------------------------

    const webDir = path.join(appDir, project.webDir ?? "dist");
    if (!fs.existsSync(webDir)) {
      findings.push({
        level: "warn",
        what: `webDir "${project.webDir}" does not exist yet`,
        detail: "Fine before the first build; a deploy builds it",
      });
    }

    findings.push(...this.checkRuntimeWiring(appDir));

    this.report(findings);
  }

  /**
   * Looks for the two calls that decide whether updates work at all.
   *
   * Textual, not semantic: this is a hint, not a compiler. Worth doing anyway -
   * a missing `notifyAppReady()` rolls back working bundles ten seconds after
   * they install, and that is invisible until it happens on a device.
   */
  private checkRuntimeWiring(appDir: string): Finding[] {
    const findings: Finding[] = [];
    const pkgPath = path.join(appDir, "package.json");

    if (!fs.existsSync(pkgPath)) return findings;

    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (!deps["@capuchoo/updater"]) {
      findings.push({
        level: "warn",
        what: "@capuchoo/updater is not a dependency",
        detail: "Deploys will work; the app will not check for what they publish",
        fix: "pnpm add @capuchoo/updater",
      });
      return findings;
    }

    const sources = this.sourceFiles(path.join(appDir, "src"));
    const joined = sources.map((file) => fs.readFileSync(file, "utf8")).join("\n");

    if (!joined.includes("notifyAppReady")) {
      findings.push({
        level: "fail",
        what: "notifyAppReady() is never called",
        detail:
          "The plugin rolls back to the previous bundle when it does not hear this " +
          "within its timeout - so every update would install and then revert",
        fix: 'Call it early in main.ts: import { notifyAppReady } from "@capuchoo/updater"',
      });
    } else {
      findings.push({ level: "ok", what: "notifyAppReady() present" });
    }

    const capacitorConfig = ["capacitor.config.ts", "capacitor.config.js"]
      .map((name) => path.join(appDir, name))
      .find((file) => fs.existsSync(file));

    if (capacitorConfig) {
      const config = fs.readFileSync(capacitorConfig, "utf8");
      if (!config.includes("capuchooUpdaterConfig") && !config.includes("capuchooUpdaterConfig")) {
        findings.push({
          level: "warn",
          what: `${path.basename(capacitorConfig)} does not use capuchooUpdaterConfig()`,
          detail:
            "Hand-written plugin config has shipped an empty updateUrl before, which " +
            "disables updates without failing",
          fix: "plugins.CapacitorUpdater = capuchooUpdaterConfig({ apiUrl, channel })",
        });
      } else {
        findings.push({ level: "ok", what: "Capacitor plugin config" });
      }
    }

    findings.push(...this.checkReleaseSigning(appDir));

    return findings;
  }

  /**
   * Whether a release build can be signed.
   *
   * A `deploy native` to a prod channel compiled for 1m51s and then failed at
   * `:app:packageProdRelease`, whose message mentions an "IncrementalSplitter"
   * and nothing about signing. The cause was four unset properties in
   * `local.properties`. This costs two file reads and reports it up front.
   */
  private checkReleaseSigning(appDir: string): Finding[] {
    const gradlePath = path.join(appDir, "android", "app", "build.gradle");
    if (!fs.existsSync(gradlePath)) return [];

    const propertiesPath = path.join(appDir, "android", "local.properties");
    const status = inspectReleaseSigning({
      buildGradle: fs.readFileSync(gradlePath, "utf8"),
      localProperties: fs.existsSync(propertiesPath) ? fs.readFileSync(propertiesPath, "utf8") : "",
    });

    if (status.kind === "unconfigured") {
      return [
        {
          level: "fail",
          what: "Release signing is not configured",
          detail: describeSigning(status),
          fix: `Add ${status.missing.join(", ")} to android/local.properties`,
        },
      ];
    }

    if (status.kind === "unsigned") {
      return [
        {
          // A warning, not a failure: an OTA deploy never builds a release APK,
          // and a debug native deploy is signed with the debug key.
          level: "warn",
          what: "The release build type signs with nothing",
          detail: describeSigning(status),
          fix: "Add a signingConfig to android/app/build.gradle before deploying a release",
        },
      ];
    }

    // A path that points at nothing fails exactly like a missing property.
    if (status.storeFile) {
      const resolved = path.resolve(appDir, "android", "app", status.storeFile);
      if (!fs.existsSync(resolved)) {
        return [
          {
            level: "fail",
            what: "The release keystore is missing",
            detail: `signingConfigs.${status.configName} points at ${status.storeFile}, which does not exist`,
            fix: `Put the keystore at ${resolved}, or correct the path in android/local.properties`,
          },
        ];
      }
    }

    return [{ level: "ok", what: "Release signing", detail: describeSigning(status) }];
  }

  /** Shallow-ish walk: enough to find an import, cheap enough to run always. */
  private sourceFiles(dir: string, depth = 0): string[] {
    if (depth > 3 || !fs.existsSync(dir)) return [];

    const found: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) found.push(...this.sourceFiles(full, depth + 1));
      else if (/\.(ts|tsx|js|vue)$/.test(entry.name)) found.push(full);
    }
    return found;
  }

  private report(findings: Finding[]): void {
    const mark = { ok: chalk.green("✓"), warn: chalk.yellow("!"), fail: chalk.red("✗") };

    this.log("");
    for (const finding of findings) {
      this.log(`  ${mark[finding.level]} ${finding.what}`);
      if (finding.detail) this.log(chalk.dim(`      ${finding.detail}`));
      if (finding.fix) this.log(chalk.cyan(`      → ${finding.fix}`));
    }

    const failed = findings.filter((f) => f.level === "fail").length;
    const warned = findings.filter((f) => f.level === "warn").length;

    this.log("");
    if (failed === 0 && warned === 0) {
      this.log(chalk.green("  Ready to deploy."));
    } else {
      this.log(
        `  ${failed} blocking, ${warned} worth a look. ` +
          chalk.dim("Fix the blocking ones before deploying."),
      );
    }
    this.log("");

    if (failed > 0) process.exitCode = 1;
  }
}
