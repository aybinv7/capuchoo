import { canCreateApps } from "@capuchoo/core";
import { Flags } from "@oclif/core";
import chalk from "chalk";
import { BaseCommand } from "../../base-command.js";
import { CloudClient } from "../../services/cloud.js";
import { resolveCredentials } from "../../utils/config.js";
import { runnable } from "../../cli/invocation.js";

export default class OrgList extends BaseCommand {
  static override description = "List the organizations this account belongs to";

  static override flags = {
    json: Flags.boolean({ default: false, description: "Machine-readable output" }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(OrgList);

    const credentials = resolveCredentials();
    if (!credentials) {
      this.error(`Not authenticated. Run ${chalk.cyan(runnable(`auth login`))}.`);
    }

    const cloud = new CloudClient(credentials.endpoint, credentials.apiKey);
    const organizations = await cloud.organizations();

    if (flags.json) {
      this.log(JSON.stringify(organizations, null, 2));
      return;
    }

    if (organizations.length === 0) {
      this.log("");
      this.log(chalk.yellow("  This account belongs to no organization yet."));
      this.log(chalk.dim('  Create one with: capuchoo org create "Your Company"') + "\n");
      return;
    }

    this.log("");
    for (const organization of organizations) {
      // Only an owner or admin can add apps, and a member finding that out from
      // a failed `init` is worse than seeing it here.
      const note = canCreateApps(organization) ? "" : chalk.dim(" - cannot create apps");
      this.log(
        `  ${organization.name.padEnd(24)} ${chalk.dim(organization.role)}${note}\n` +
          `  ${chalk.dim(organization.slug)}`,
      );
    }
    this.log("");
  }
}
