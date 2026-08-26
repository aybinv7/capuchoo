import { askText, confirm, log, selectOne, whileWaiting } from "../cli/prompts.js";
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
import {
  projectConfigPath,
  readProjectConfig,
  resolveCredentials,
  writeProjectConfig,
} from "../utils/config.js";
import AuthLogin from "./auth/login.js";
import { BaseCommand } from "../base-command.js";

/** The answers --create can supply, so the wizard has nothing left to ask. */
interface CreateFlags {
  name?: string | undefined;
  appId?: string | undefined;
  org?: string | undefined;
}

export default class Init extends BaseCommand {
  static override description =
    "Link this directory to a Capuchoo app and write .capuchoo/project.json";

  static override examples = [
    "<%= config.bin %> init",
    "<%= config.bin %> init --link",
    "<%= config.bin %> init --create",
    '<%= config.bin %> init --create --name "My App" --app-id com.acme.app --channel staging',
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
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Init);
    const appDir = process.cwd();

    this.log("");
    this.log(chalk.bold("  Initialise Capuchoo"));
    this.log(chalk.dim(`  ${appDir}`));
    this.log("");

    const existing = readProjectConfig(appDir);
    if (existing && !flags.force) {
      this.log(chalk.yellow("  Already initialised: ") + `${existing.appName} (${existing.appId})`);
      const action = await selectOne<string>(
        "What now?",
        [
          { value: "keep", label: "Keep it", hint: existing.appId },
          { value: "relink", label: "Re-link to a different app" },
        ],
        "--force",
      );
      if (action === "keep") return;
    }

    // --- credentials ---------------------------------------------------------

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
          chalk.cyan(`capuchoo deploy ota --channel ${deployable[0]!.name}`),
      );
    } else {
      // An app with no channel is not deployable, and init already knows it.
      // Sending people to the dashboard here was the one thing that made setting
      // an app up a CLI-browser-CLI round trip.
      await this.offerFirstChannel(cloud, app, flags.channel);
    }
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
        chalk.dim("  Deploy with: ") + chalk.cyan(`capuchoo deploy ota --channel ${channel.name}`),
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
        chalk.dim("  Deploy with: ") + chalk.cyan(`capuchoo deploy ota --channel ${created[0]}`),
      );
    }

    if (failed.length > 0) {
      this.log(chalk.dim(`  Retry the rest with: capuchoo channel create ${failed[0]}`));
    }

    // A channel per client, or per A/B arm, is an audience rather than a stage -
    // one more channel on the prod environment, not another set of three.
    this.log(
      chalk.dim("  A client or A/B channel is an extra one on prod: ") +
        chalk.cyan("capuchoo channel create <name>"),
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
      creating.succeed(`Created ${app.name}`);
      return app;
    } catch (error) {
      creating.fail("Could not create the app");
      this.error(error instanceof Error ? error.message : String(error));
    }
  }
}
