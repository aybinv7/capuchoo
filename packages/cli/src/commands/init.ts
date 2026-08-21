import { askText, confirm, selectOne } from "../cli/prompts.js";
import {
  ENVIRONMENTS,
  PROJECT_CONFIG_VERSION,
  canCreateApps,
  defaultFlavour,
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
import { CloudClient } from "../services/cloud.js";
import {
  projectConfigPath,
  readProjectConfig,
  resolveCredentials,
  writeProjectConfig,
} from "../utils/config.js";
import AuthLogin from "./auth/login.js";
import { BaseCommand } from "../base-command.js";

export default class Init extends BaseCommand {
  static override description =
    "Link this directory to a Capucho app and write .capucho/project.json";

  static override examples = ["<%= config.bin %> init", "<%= config.bin %> init --link"];

  static override flags = {
    link: Flags.boolean({
      char: "l",
      default: false,
      description: "Link an existing app instead of creating one",
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
    this.log(chalk.bold("  Initialise Capucho"));
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

    const mode = flags.link
      ? "existing"
      : await selectOne<string>(
          "Link this directory to",
          [
            { value: "existing", label: "An app that already exists" },
            { value: "new", label: "A new app" },
          ],
          "--link",
        );

    const app = mode === "existing" ? await this.linkExisting(cloud) : await this.createNew(cloud);

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
      this.log(chalk.yellow("  This app has no channel with an environment set yet."));
      this.log(
        chalk.dim(
          "  Create one in the dashboard - the environment is what tells the CLI\n" +
            "  which flavour to build.",
        ),
      );
    }
    this.log("");
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

  private async linkExisting(cloud: CloudClient): Promise<CloudApp> {
    const spinner = ora({ text: "Fetching apps", stream: process.stderr }).start();
    const apps = await cloud.apps();
    spinner.stop();

    if (apps.length === 0) {
      this.error(
        "This account has no apps yet. Re-run and choose to create one, or " +
          "create it in the dashboard.",
      );
    }

    return selectOne(
      "App",
      apps.map((app) => ({ value: app, label: app.name, hint: app.app_id })),
      "--link with the app selected in the dashboard",
    );
  }

  private async createNew(cloud: CloudClient): Promise<CloudApp> {
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

    const organizationId =
      allowed.length === 1
        ? allowed[0]!.id
        : await selectOne(
            "Organization",
            allowed.map((org) => ({ value: org.id, label: org.name, hint: org.role })),
            "--link",
          );

    const name = await askText("App name", {
      initial: path.basename(process.cwd()),
      flag: "--link",
    });

    const appId = await askText("Production bundle identifier", {
      placeholder: "com.company.app",
      flag: "--link",
      validate: (value) =>
        isValidBundleId(value.trim())
          ? undefined
          : "Expected something like com.company.app - lower case, at least two segments",
    });

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
