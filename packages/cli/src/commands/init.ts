import { askText, confirm, isInteractive, log, selectOne, whileWaiting } from "../cli/prompts.js";
import {
  DEFAULT_CHANNELS,
  ENVIRONMENTS,
  PROJECT_CONFIG_VERSION,
  canCreateApps,
  canPublishTo,
  defaultFlavour,
  environmentMismatchWarning,
  suggestEnvironment,
  isValidBundleId,
  type CloudApp,
  type Environment,
  type FlavourConfig,
  type ProjectConfig,
  type UserProfile,
} from "@capuchoo/core";
import { Flags } from "@oclif/core";
import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";
import ora from "ora";
import {
  conflictingIds,
  detectIdentity,
  type AppIdentity,
  type Detected,
  type ProjectFiles,
} from "../pipeline/app-identity.js";
import { CloudClient } from "../services/cloud.js";
import { HttpError } from "../utils/http.js";
import {
  projectConfigPath,
  readAppVersion,
  readProjectConfig,
  requireProjectConfig,
  resolveCredentials,
  writeProjectConfig,
} from "../utils/config.js";
import AuthLogin from "./auth/login.js";
import { BaseCommand } from "../base-command.js";
import { INIT_STEPS, selectSteps, type InitStepId } from "../cli/init-plan.js";
import { waitForAdoption } from "../init/prove.js";
import { runnable } from "../cli/invocation.js";
import {
  renderOutcomes,
  stepCode,
  stepEnv,
  stepIdentifiers,
  stepPackages,
  type StepContext,
  type StepOutcome,
} from "../init/steps.js";

/**
 * How long --prove waits for a device, and how often it asks.
 *
 * Two minutes is long enough to open an app on a phone and short enough that a
 * forgotten terminal is not left spinning. The poll is generous because the
 * backend sleeps when idle and this is not a race.
 */
const PROVE_TIMEOUT_MS = 120_000;
const PROVE_POLL_MS = 5_000;

/** The answers --create can supply, so the wizard has nothing left to ask. */
interface CreateFlags {
  name?: string | undefined;
  appId?: string | undefined;
  org?: string | undefined;
}

export default class Init extends BaseCommand {
  static override description = "Set this app up to receive updates, from nothing to verified";

  // `setup` was a second command that installed packages and then printed three
  // edits to apply by hand. Both halves live here now, so there is one command
  // to run and it is safe to re-run.
  static override aliases = ["setup"];

  static override examples = [
    "<%= config.bin %> init",
    "<%= config.bin %> init --yes",
    "<%= config.bin %> init --dry-run",
    "<%= config.bin %> init --only env --only code",
    '<%= config.bin %> init --create --name "My App" --app-id com.acme.app',
  ];

  static override flags = {
    link: Flags.boolean({
      char: "l",
      default: false,
      description: "Link an existing app instead of asking",
      exclusive: ["create"],
    }),
    // Without this, a non-interactive shell could only ever link: the prompt
    // named --link as its escape hatch and there was no flag for the other half
    // of the same question.
    create: Flags.boolean({
      char: "c",
      default: false,
      description: "Create a new app instead of asking",
      exclusive: ["link"],
    }),
    name: Flags.string({
      description: "Name of the app to create (default: this directory's name)",
      dependsOn: ["create"],
    }),
    // Used by both halves: with --create it is the identifier to register, with
    // --link the identifier to select. Either way it names the app.
    "app-id": Flags.string({
      description: "Bundle identifier of the app, e.g. com.company.app",
    }),
    org: Flags.string({
      description: "Organization to create the app in, by name or id",
      dependsOn: ["create"],
    }),
    channel: Flags.string({
      description: "Create this channel after linking, e.g. staging",
    }),
    force: Flags.boolean({
      char: "f",
      default: false,
      description: "Overwrite an existing project.json",
    }),
    yes: Flags.boolean({
      char: "y",
      default: false,
      description: "Apply every change without asking",
    }),
    // Scoped to the wiring steps, and it says so: linking creates a cloud app,
    // which is not something a flag called --dry-run should do. Refused on an
    // unlinked directory rather than half-honoured.
    "dry-run": Flags.boolean({
      default: false,
      description: "Report the wiring changes without writing (needs a linked directory)",
    }),
    native: Flags.boolean({
      default: false,
      description: "Also install what downloading and installing an APK needs",
    }),
    "skip-telemetry": Flags.boolean({
      default: false,
      description: "Do not install @capacitor/device",
    }),
    "skip-sync": Flags.boolean({
      default: false,
      description: "Do not run cap sync after installing",
    }),
    skip: Flags.string({
      multiple: true,
      description: `Steps to leave out: ${INIT_STEPS.join(", ")}`,
    }),
    only: Flags.string({
      multiple: true,
      description: "Run only these steps (verify always runs unless skipped)",
    }),
    prove: Flags.boolean({
      default: false,
      description: "Publish a release and wait for a device to take it",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Init);
    const appDir = process.cwd();

    this.log("");
    this.log(chalk.bold("  Initialise Capuchoo"));
    this.log(chalk.dim(`  ${appDir}`));
    this.log("");

    const existing = readProjectConfig(appDir);

    if (flags["dry-run"] && !existing) {
      this.error(
        "--dry-run reports what the wiring steps would change, and this directory is " +
          "not linked yet. Linking creates a cloud app, which a dry run must not do.\n\n" +
          "Run init without --dry-run to link, then --dry-run to inspect the rest.",
      );
    }

    // Already linked: re-run the steps rather than asking whether to.
    //
    // This used to offer "keep it" or "re-link", and "keep it" returned without
    // doing anything - so the command that was supposed to finish setting an app
    // up did nothing at all on the second run, which is most of why knowing
    // whether to run `setup` or `init` mattered. Re-linking is a real but rare
    // intent, and it has a flag.
    if (existing && !flags.force) {
      this.log(chalk.dim("  linked to ") + `${existing.appName} (${existing.appId})`);
      this.log(chalk.dim("  Re-link to a different app with --force."));

      const { cloud } = await this.signIn();
      await this.wireUp(
        appDir,
        cloud,
        { id: existing.cloudAppId, app_id: existing.appId, name: existing.appName } as CloudApp,
        flags,
      );
      return;
    }

    const { cloud, profile } = await this.signIn();

    // --- pick or create the app ---------------------------------------------

    const mode = await this.resolveMode(cloud, appDir, flags);

    const app =
      mode === "existing"
        ? await this.linkExisting(
            cloud,
            flags["app-id"] ?? this.detectIdentity(appDir).appId?.value,
          )
        : await this.createNew(cloud, {
            name: flags.name,
            appId: flags["app-id"],
            org: flags.org,
          });

    // The key that just created or linked this app may not be allowed to publish
    // to it: an app-scoped key can read every app the account owns. Say so here
    // rather than let the first deploy discover it after a full build.
    if (!canPublishTo(profile, app.id)) {
      this.log("");
      this.log(
        chalk.yellow(
          "  The API key in use is restricted to another app, so deploys from here\n" +
            `  will be refused. Run "capuchoo auth login" with a key for ${app.name}\n` +
            "  or an unscoped one.",
        ),
      );
    }

    // --- flavours ------------------------------------------------------------

    const flavours = this.detectFlavours(appDir);
    const detected = Object.keys(flavours) as Environment[];

    if (detected.length > 0) {
      this.log("");
      this.log(chalk.dim(`  Detected flavours: ${detected.join(", ")}`));
    } else {
      this.log("");
      this.log(
        chalk.yellow(
          "  No build/<env>/.env.<env> files found. The conventional layout will be\n" +
            "  written anyway - create the files, or edit project.json to point elsewhere.",
        ),
      );
    }

    const config: ProjectConfig = {
      version: PROJECT_CONFIG_VERSION,
      appId: app.app_id,
      cloudAppId: app.id,
      appName: app.name,
      createdAt: new Date().toISOString(),
      webDir: this.detectWebDir(appDir),
      androidDir: "android",
      iosDir: "ios",
      versionCodeFile: "version-code.json",
      // Written out explicitly, even where it matches the default: this file is
      // the contract with the CLI, and an explicit contract is easier to change
      // than an implied one.
      flavours: Object.fromEntries(
        ENVIRONMENTS.map((environment) => [
          environment,
          flavours[environment] ?? defaultFlavour(environment),
        ]),
      ),
    };

    writeProjectConfig(appDir, config);

    // --- report --------------------------------------------------------------

    this.log("");
    this.log(chalk.green("  Linked."));
    this.log(chalk.dim(`  ${path.relative(appDir, projectConfigPath(appDir))}`));
    this.log("");
    this.log(`  app        ${chalk.cyan(app.name)}`);
    this.log(`  bundle id  ${chalk.cyan(app.app_id)}`);
    this.log(`  cloud id   ${chalk.dim(app.id)}`);
    this.log("");

    const channels = await cloud.channels(app.id).catch(() => []);
    const deployable = channels.filter((channel) => channel.environment);

    if (deployable.length > 0) {
      this.log(chalk.bold("  channels"));
      for (const channel of deployable) {
        this.log(`    ${channel.name} ${chalk.dim(`(${channel.environment})`)}`);
      }
      this.log("");
      this.log(
        chalk.dim("  Deploy with: ") +
          chalk.cyan(runnable(`deploy ota --channel ${deployable[0]!.name}`)),
      );
    } else {
      // An app with no channel is not deployable, and init already knows it.
      // Sending people to the dashboard here was the one thing that made setting
      // an app up a CLI-browser-CLI round trip.
      await this.offerFirstChannel(cloud, app, flags.channel);
    }
    this.log("");

    await this.wireUp(appDir, cloud, app, flags);
  }

  /**
   * Signs in if needed, and hands back a client that has been proven to work.
   *
   * `whoami` is checked here rather than left to the first real call: a rejected
   * credential discovered three steps later reads as whatever that step was
   * doing.
   */
  private async signIn(): Promise<{ cloud: CloudClient; profile: UserProfile }> {
    let credentials = resolveCredentials();

    if (!credentials) {
      this.log(chalk.dim("  No credentials found yet.\n"));
      try {
        await AuthLogin.performLogin();
      } catch (error) {
        this.error(error instanceof Error ? error.message : String(error));
      }
      credentials = resolveCredentials();
    }

    if (!credentials) {
      this.error("Still not authenticated, so this directory cannot be linked.");
    }

    const cloud = new CloudClient(credentials.endpoint, credentials.apiKey);
    const profile = await cloud.whoami();

    if (!profile) {
      this.error(`The credentials for ${credentials.endpoint} were rejected.`);
    }

    return { cloud, profile };
  }

  /**
   * Everything between "linked" and "can receive an update".
   *
   * This used to be a printed list of three edits at the end of `setup`, and
   * nobody applied them: every first run - two of mine and one of the user's -
   * got as far as `deploy` and was refused for a missing VITE_UPDATE_API_URL. A
   * wall of text after an install is not a step anybody performs.
   *
   * Each step decides for itself whether it is already done, so running init
   * again is a no-op plus a check. That is what removes the need to know which
   * of `login`, `setup` and `init` you wanted.
   */
  private async wireUp(
    appDir: string,
    cloud: CloudClient,
    app: CloudApp,
    flags: {
      yes: boolean;
      "dry-run": boolean;
      native: boolean;
      "skip-telemetry": boolean;
      "skip-sync": boolean;
      prove: boolean;
      channel?: string | undefined;
      skip?: string[] | undefined;
      only?: string[] | undefined;
    },
  ): Promise<void> {
    const project = requireProjectConfig(appDir);
    const context: StepContext = {
      appDir,
      project,
      endpoint: cloud.endpoint,
      cloud,
      cloudAppId: app.id,
      bundleId: app.app_id,
      interactive: isInteractive() && !flags.yes,
      assumeYes: flags.yes,
      dryRun: flags["dry-run"],
      cliVersion: this.config.version,
      native: flags.native,
      telemetry: !flags["skip-telemetry"],
      sync: !flags["skip-sync"],
    };

    const runners: Array<[InitStepId, () => Promise<StepOutcome>]> = [
      ["identifiers", () => stepIdentifiers(context)],
      ["packages", () => stepPackages(context)],
      ["env", () => stepEnv(context)],
      ["code", () => stepCode(context)],
    ];

    const wanted = new Set(
      selectSteps(
        runners.map(([id]) => ({ id, status: "todo" as const, why: "" })),
        { only: flags.only, skip: flags.skip },
      ).map((step) => step.id),
    );

    const outcomes: StepOutcome[] = [];
    for (const [id, runner] of runners) {
      if (!wanted.has(id)) continue;
      // Reported rather than thrown: a step that could not finish must not hide
      // the ones after it.
      outcomes.push(await runner());
    }

    if (outcomes.length > 0) {
      this.log("");
      this.log(renderOutcomes(outcomes));
      this.log("");
    }

    if (flags["dry-run"]) {
      log.info("Dry run: nothing was written.");
      return;
    }

    const failed = outcomes.filter((outcome) => outcome.state === "failed");
    if (failed.length > 0) {
      this.error(failed.map((outcome) => `${outcome.id}: ${outcome.detail}`).join("\n"));
    }

    // Always, and never cached: a step that reports "already done" is a claim,
    // and doctor is the only thing here that checks.
    if (!flags.skip?.includes("verify")) {
      await this.config.runCommand("doctor", []);
    }

    if (flags.prove) await this.prove(appDir, cloud, app, flags);
  }

  /**
   * Publishes, then waits for a device to take it.
   *
   * The only step that produces evidence instead of a claim. Everything before
   * it checks configuration; this one shows that a real install asked this
   * backend and was handed the bundle that was just published.
   *
   * Off unless asked, because it builds the app and uploads a release - not
   * something a command should do as a side effect of being run twice.
   */
  private async prove(
    appDir: string,
    cloud: CloudClient,
    app: CloudApp,
    flags: { channel?: string | undefined; yes: boolean },
  ): Promise<void> {
    const channels = await cloud.channels(app.id).catch(() => []);
    const target =
      channels.find((channel) => channel.name === flags.channel) ??
      channels.find((channel) => channel.environment === "dev") ??
      channels[0];

    if (!target) {
      this.error("There is no channel to publish to. Create one, then run init --prove again.");
    }

    this.log("");
    this.log(chalk.bold(`  Publishing to ${target.name}`));

    // Reuses the deploy command rather than reimplementing it: the build, the
    // signing check, the archive format and the upload all live there, and a
    // second copy of that is how the two drift.
    await this.config.runCommand("deploy:ota", [
      "--channel",
      target.name,
      ...(flags.yes ? ["--yes"] : []),
    ]);

    const version = readAppVersion(appDir);

    this.log("");
    this.log(chalk.bold(`  Waiting for a device to take ${version}`));
    this.log(
      chalk.dim(
        "  Open the app on a device or emulator. Ctrl+C to stop waiting - the\n" +
          "  bundle stays published either way.",
      ),
    );

    const spin = ora({ text: "No device yet", stream: process.stderr }).start();

    const { adopted, adoption } = await waitForAdoption(
      () => cloud.updateLogs(app.app_id),
      version,
      {
        timeoutMs: PROVE_TIMEOUT_MS,
        pollMs: PROVE_POLL_MS,
        onAttempt: (elapsed) => {
          spin.text = `No device yet (${Math.round(elapsed / 1000)}s)`;
        },
      },
    );

    if (adopted) {
      spin.succeed(
        `${adoption.devices} device${adoption.devices === 1 ? "" : "s"} took ${version}`,
      );
      this.log("");
      this.log(chalk.green("  Updates work end to end."));
      this.log("");
      return;
    }

    // Not a failure of the deploy: nothing asked while we were watching, which
    // is the normal case when nothing is running.
    spin.stop();
    this.log("");
    this.log(
      chalk.yellow(`  No device asked for an update in ${PROVE_TIMEOUT_MS / 1000}s.`) +
        `\n  ${chalk.dim(`${version} is published on ${target.name} and will be served when one does.`)}`,
    );
    this.log("");
  }

  /**
   * Creates the channels a linked app needs before anything can be deployed.
   *
   * Without `--channel` this creates the standard three - prod, staging and dev,
   * each on its matching environment. That is the pipeline every app wants, and
   * an app that had none failed its first deploy on a channel/environment
   * pairing the user had to work out from an error message.
   *
   * `--channel <name>` still creates exactly one, because naming a channel is a
   * statement of intent: a per-client or A/B channel is an audience rather than
   * a stage, and belongs on the prod environment rather than in a set of three.
   */
  private async offerFirstChannel(
    cloud: CloudClient,
    app: CloudApp,
    requested: string | undefined,
  ): Promise<void> {
    const name = requested?.trim();

    if (!name) {
      await this.createDefaultChannels(cloud, app);
      return;
    }

    const chosen = name;

    const environment =
      suggestEnvironment(chosen) ??
      (await selectOne(
        `Which flavour should "${chosen}" serve?`,
        ENVIRONMENTS.map((value) => ({ value, label: value })),
        "--channel <name> with a name like staging",
      ));

    const warning = environmentMismatchWarning(chosen, environment);
    if (warning) log.warn(warning);

    try {
      const channel = await cloud.createChannel({ app_id: app.id, name: chosen, environment });
      this.log("");
      this.log(
        `  ${chalk.green("Created channel")} ${channel.name} ${chalk.dim(`(${environment})`)}`,
      );
      this.log(
        chalk.dim("  Deploy with: ") + chalk.cyan(runnable(`deploy ota --channel ${channel.name}`)),
      );
    } catch (error) {
      // The app and project.json are already correct, so this is a warning and
      // not a failure - `capuchoo channel create` retries just this step.
      this.log("");
      this.log(
        chalk.yellow(
          `  The channel could not be created: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      );
      this.log(chalk.dim(`  Retry with: capuchoo channel create ${chosen}`));
    }
  }

  /**
   * Creates prod, staging and dev, each on its matching environment.
   *
   * Created rather than offered one at a time: an app with no channel cannot be
   * deployed to at all, and these three are never the wrong answer - they are
   * the environments the CLI already builds for. Asking "channel name?" made the
   * first thing a new user saw a question they had no basis to answer.
   *
   * Each is attempted independently. A partial result is useful, and one
   * failure - a name already taken, say - should not cost the other two.
   */
  private async createDefaultChannels(cloud: CloudClient, app: CloudApp): Promise<void> {
    this.log(chalk.bold("  channels"));

    const created: string[] = [];
    const failed: string[] = [];

    for (const { name, environment } of DEFAULT_CHANNELS) {
      try {
        await cloud.createChannel({ app_id: app.id, name, environment });
        this.log(`    ${chalk.green("+")} ${name} ${chalk.dim(`(${environment})`)}`);
        created.push(name);
      } catch (error) {
        this.log(
          `    ${chalk.yellow("!")} ${name} ${chalk.dim(
            error instanceof Error ? error.message : String(error),
          )}`,
        );
        failed.push(name);
      }
    }

    this.log("");

    if (created.length > 0) {
      this.log(
        chalk.dim("  Deploy with: ") + chalk.cyan(runnable(`deploy ota --channel ${created[0]}`)),
      );
    }

    if (failed.length > 0) {
      this.log(chalk.dim(`  Retry the rest with: capuchoo channel create ${failed[0]}`));
    }

    // A channel per client, or per A/B arm, is an audience rather than a stage -
    // one more channel on the prod environment, not another set of three.
    this.log(
      chalk.dim("  A client or A/B channel is an extra one on prod: ") +
        chalk.cyan(runnable(`channel create <name>`)),
    );
  }

  /** Reads the files that declare an app's identity, skipping any that are absent. */
  private projectFiles(appDir: string): ProjectFiles {
    const read = (...parts: string[]): string | undefined => {
      const file = path.join(appDir, ...parts);
      return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : undefined;
    };

    const capacitorConfig = ["capacitor.config.ts", "capacitor.config.js", "capacitor.config.json"]
      .map((name) => read(name))
      .find(Boolean);

    return {
      capacitorConfig,
      buildGradle: read("android", "app", "build.gradle"),
      envFile: read(defaultFlavour("prod").envFile),
      packageJson: read("package.json"),
    };
  }

  private detectIdentity(appDir: string): AppIdentity {
    return detectIdentity(this.projectFiles(appDir));
  }

  private conflictingIds(appDir: string, chosen: string): Detected[] {
    return conflictingIds(this.projectFiles(appDir), chosen);
  }

  /** Detects which flavours the project actually has files for. */
  private detectFlavours(appDir: string): Partial<Record<Environment, FlavourConfig>> {
    const found: Partial<Record<Environment, FlavourConfig>> = {};

    for (const environment of ENVIRONMENTS) {
      const candidate = defaultFlavour(environment);
      if (fs.existsSync(path.join(appDir, candidate.envFile))) {
        found[environment] = candidate;
      }
    }

    return found;
  }

  /** Reads `webDir` out of capacitor.config.* so the CLI zips the right folder. */
  private detectWebDir(appDir: string): string {
    for (const name of ["capacitor.config.ts", "capacitor.config.js", "capacitor.config.json"]) {
      const file = path.join(appDir, name);
      if (!fs.existsSync(file)) continue;

      const match = /webDir\s*[:=]\s*["']([^"']+)["']/.exec(fs.readFileSync(file, "utf8"));
      if (match?.[1]) return match[1];
    }

    return "dist";
  }

  /**
   * Whether to link or create, answered by the project rather than asked.
   *
   * "Existing app, or a new one?" was the first question `init` asked, and the
   * project already knows: the bundle id it declares either exists on the
   * account or it does not. Only an ambiguous project - no detectable id - is
   * still a question.
   */
  private async resolveMode(
    cloud: CloudClient,
    appDir: string,
    flags: { link: boolean; create: boolean; "app-id"?: string | undefined },
  ): Promise<"existing" | "new"> {
    if (flags.link) return "existing";
    if (flags.create) return "new";

    const wanted = flags["app-id"] ?? this.detectIdentity(appDir).appId?.value;

    if (wanted) {
      const apps = await whileWaiting("Looking for this app...", cloud.apps()).catch(() => null);

      if (apps) {
        const match = apps.find((app) => app.app_id === wanted);
        log.info(
          match
            ? `${wanted} already exists on this account - linking to it.`
            : `${wanted} is not on this account yet - creating it.`,
        );
        return match ? "existing" : "new";
      }
    }

    return selectOne<"existing" | "new">(
      "Should this directory publish to an existing app, or a new one?",
      [
        { value: "existing", label: "An app that already exists" },
        { value: "new", label: "A new app" },
      ],
      "--link or --create",
    );
  }

  private async linkExisting(cloud: CloudClient, wanted?: string): Promise<CloudApp> {
    const spinner = ora({ text: "Fetching apps", stream: process.stderr }).start();
    const apps = await cloud.apps();
    spinner.stop();

    if (apps.length === 0) {
      this.error("This account has no apps yet. Run capuchoo init --create to register one.");
    }

    if (wanted) {
      const match = apps.find((app) => app.app_id === wanted || app.id === wanted);
      if (!match) {
        this.error(
          `No app called "${wanted}" on this account. ` +
            `Available: ${apps.map((app) => app.app_id).join(", ")}.`,
        );
      }
      return match;
    }

    return selectOne(
      "Which app does this directory publish to?",
      apps.map((app) => ({ value: app, label: app.name, hint: app.app_id })),
      "--app-id",
    );
  }

  private async createNew(cloud: CloudClient, given: CreateFlags): Promise<CloudApp> {
    const spinner = ora({
      text: "Fetching organizations",
      stream: process.stderr,
    }).start();
    const organizations = await cloud.organizations();
    spinner.stop();

    const allowed = organizations.filter(canCreateApps);

    if (allowed.length === 0) {
      this.error(
        organizations.length === 0
          ? "This account belongs to no organization yet."
          : "This account is a member, not an owner or admin, of every organization " +
              "it belongs to, so it cannot create an app. Ask an owner.",
      );
    }

    const requested = given.org?.trim().toLowerCase();
    const chosen = requested
      ? allowed.find((org) => org.id === given.org?.trim() || org.name.toLowerCase() === requested)
      : undefined;
    if (requested && !chosen) {
      this.error(
        `No organization called "${given.org}" that this account can create apps in. ` +
          `Available: ${allowed.map((org) => org.name).join(", ")}.`,
      );
    }

    const organizationId =
      chosen?.id ??
      (allowed.length === 1
        ? allowed[0]!.id
        : await selectOne(
            "Organization",
            allowed.map((org) => ({ value: org.id, label: org.name, hint: org.role })),
            "--org",
          ));

    // Detected, then confirmed. The project already declares both, and the
    // bundle id in particular is not a free choice: the device reports whatever
    // is compiled into the binary, so a value typed here that disagrees produces
    // "App not found" on a phone and nowhere earlier.
    const detected = this.detectIdentity(process.cwd());

    if (detected.appId) {
      log.info(`Bundle id ${detected.appId.value} - from ${detected.appId.source}`);
    }

    const name =
      given.name?.trim() ||
      (await askText("App name", {
        initial: detected.appName?.value ?? path.basename(process.cwd()),
        flag: "--name",
      }));

    const appId =
      given.appId?.trim() ||
      (await askText("Production bundle identifier", {
        initial: detected.appId?.value ?? "",
        placeholder: "com.company.app",
        flag: "--app-id",
        validate: (value) =>
          isValidBundleId(value.trim())
            ? undefined
            : "Expected something like com.company.app - lower case, at least two segments",
      }));

    for (const conflict of this.conflictingIds(process.cwd(), appId.trim())) {
      log.warn(
        `${conflict.source} says ${conflict.value}. A device reports the id compiled ` +
          "into its binary, so these have to match or the server will not find the app.",
      );
    }

    if (!isValidBundleId(appId)) {
      this.error(
        `"${appId}" is not a bundle identifier. Expected something like com.company.app - ` +
          "lower case, at least two segments.",
      );
    }

    // Creating an app is the one irreversible thing this command does.
    const proceed = await confirm(`Create "${name}" (${appId})?`, { default: true });
    if (!proceed) this.error("Cancelled.");

    const creating = ora({ text: "Creating app", stream: process.stderr }).start();
    try {
      const app = await cloud.createApp({
        name: name.trim(),
        app_id: appId.trim(),
        platform: "android",
        organization_id: organizationId,
      });
      const adopted = (app as { adopted?: boolean }).adopted === true;
      creating.succeed(adopted ? `Linked to the existing ${app.name}` : `Created ${app.name}`);

      if (adopted) {
        log.info(
          "That bundle identifier was already registered here, so this linked to it " +
            "instead of registering a second app.",
        );
      }

      return app;
    } catch (error) {
      if (error instanceof HttpError && error.status === 409) {
        creating.fail("That bundle identifier is taken");
        this.error(
          `${error.message}

` +
            `  Either change the applicationId this app builds with, or have an
` +
            `  administrator of the owning organisation grant you access to it -
` +
            `  then run ${chalk.cyan(runnable(`init`))} again and it will link rather than create.`,
        );
      }

      creating.fail("Could not create the app");
      this.error(error instanceof Error ? error.message : String(error));
    }
  }
}
