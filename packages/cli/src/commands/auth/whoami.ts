import { Flags } from "@oclif/core";
import chalk from "chalk";
import { CloudClient } from "../../services/cloud.js";
import { resolveCredentials } from "../../utils/config.js";
import { BaseCommand } from "../../base-command.js";

export default class AuthWhoami extends BaseCommand {
  static override description =
    "Show the signed-in account, and the organizations and apps it can reach";

  static override flags = {
    json: Flags.boolean({ default: false, description: "Machine-readable output" }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(AuthWhoami);
    const credentials = resolveCredentials();

    if (!credentials) {
      if (flags.json) {
        this.log(JSON.stringify({ authenticated: false }, null, 2));
        return;
      }
      this.log("");
      this.log(chalk.yellow("  Not signed in."));
      this.log(`  Run ${chalk.cyan("capuchoo auth login")}.`);
      this.log("");
      return;
    }

    // Always asks the server. The old command printed organizations and apps
    // from the local config file - which login never wrote - so it always said
    // "No apps found", and it reported a session as valid without checking.
    const cloud = new CloudClient(credentials.endpoint, credentials.apiKey);
    const profile = await cloud.whoami();

    if (!profile) {
      if (flags.json) {
        this.log(JSON.stringify({ authenticated: false, endpoint: credentials.endpoint }, null, 2));
        process.exitCode = 1;
        return;
      }
      this.error(
        `The stored credentials for ${credentials.endpoint} are no longer valid. ` +
          `Run ${chalk.cyan("capuchoo auth login")}.`,
      );
    }

    if (flags.json) {
      this.log(
        JSON.stringify(
          {
            authenticated: true,
            endpoint: credentials.endpoint,
            credentialSource: credentials.source,
            user: profile.user,
            organizations: profile.organizations,
            apps: profile.apps,
            credential: profile.credential ?? null,
          },
          null,
          2,
        ),
      );
      return;
    }

    this.log("");
    this.log(`  ${chalk.bold("account")}   ${chalk.green(profile.user.email)}`);
    this.log(`  ${chalk.bold("endpoint")}  ${credentials.endpoint}`);
    this.log(
      `  ${chalk.bold("source")}    ${
        credentials.source === "environment"
          ? "CAPUCHOO_ENDPOINT / CAPUCHOO_API_KEY"
          : "~/.capuchoo/config.json"
      }`,
    );

    if (profile.organizations.length > 0) {
      this.log("");
      this.log(chalk.bold("  organizations"));
      for (const org of profile.organizations) {
        this.log(`    ${org.name} ${chalk.dim(`(${org.role})`)}`);
      }
    }

    if (profile.apps.length > 0) {
      this.log("");
      this.log(chalk.bold("  apps"));

      // These are the apps the *account* owns. An app-scoped key can publish to
      // exactly one of them, so listing all of them unqualified is how "capuchoo
      // app list shows one app but whoami shows three" happens.
      const scope = profile.credential?.app_id;

      for (const app of profile.apps) {
        const note = scope && app.id !== scope ? chalk.dim(" - this key cannot publish to it") : "";
        this.log(`    ${app.name} ${chalk.dim(app.app_id)}${note}`);
      }

      if (scope) {
        const scoped = profile.apps.find((app) => app.id === scope);
        this.log("");
        this.log(
          chalk.dim(
            `  This key is restricted to ${scoped ? scoped.app_id : scope}. ` +
              "Use an unscoped key to work across apps.",
          ),
        );
      }
    } else {
      this.log("");
      this.log(chalk.dim("  This key can reach no apps yet."));
    }

    this.log("");
  }
}
