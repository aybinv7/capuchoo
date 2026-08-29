import { Args, Flags } from "@oclif/core";
import chalk from "chalk";
import { BaseCommand } from "../../base-command.js";
import { CloudClient } from "../../services/cloud.js";
import { resolveCredentials } from "../../utils/config.js";
import { runnable } from "../../cli/invocation.js";

/**
 * An account with no organization cannot own an app, so this was the one step
 * that forced a browser before anything else could happen. The server derives
 * the slug - two organizations called "SIG Service" must not both become
 * `sig-service`.
 */
export default class OrgCreate extends BaseCommand {
  static override description = "Create an organization";

  static override examples = [
    '<%= config.bin %> org create "SIG Service"',
    "<%= config.bin %> org create Acme --json",
  ];

  static override args = {
    name: Args.string({ description: "Display name of the organization" }),
  };

  static override flags = {
    json: Flags.boolean({ default: false, description: "Machine-readable output" }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(OrgCreate);

    const credentials = resolveCredentials();
    if (!credentials) {
      this.error(`Not authenticated. Run ${chalk.cyan(runnable(`auth login`))}.`);
    }

    const name = args.name?.trim();
    if (!name) {
      this.error('What should it be called? e.g. capuchoo org create "SIG Service".');
    }

    const cloud = new CloudClient(credentials.endpoint, credentials.apiKey);
    const organization = await cloud.createOrganization({ name });

    if (flags.json) {
      this.log(JSON.stringify(organization, null, 2));
      return;
    }

    this.log("");
    this.log(`  ${chalk.green("Created")} ${organization.name} ${chalk.dim(organization.slug)}`);
    this.log(chalk.dim("  Add an app to it with: capuchoo init --create") + "\n");
  }
}
