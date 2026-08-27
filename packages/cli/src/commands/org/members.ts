import { Flags } from "@oclif/core";
import chalk from "chalk";
import { BaseCommand } from "../../base-command.js";
import { membershipRows } from "../../cli/members.js";
import { selectOne, whileWaiting } from "../../cli/prompts.js";
import { requireCloud } from "../../cli/team.js";

export default class OrgMembers extends BaseCommand {
  static override description = "List the people in an organization";

  static override examples = ["<%= config.bin %> org members"];

  static override flags = {
    org: Flags.string({ description: "Organization by name or id" }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(OrgMembers);
    const cloud = requireCloud(this);

    const organizations = await whileWaiting("Reading organizations...", cloud.organizations());
    if (organizations.length === 0) this.error("This account is in no organizations.");

    const wanted = flags.org?.trim().toLowerCase();
    const organization = wanted
      ? organizations.find(
          (org) => org.name.toLowerCase() === wanted || org.id.toLowerCase() === wanted,
        )
      : organizations.length === 1
        ? organizations[0]
        : await selectOne(
            "Which organization?",
            organizations.map((org) => ({ value: org, label: org.name, hint: org.role })),
            "--org",
          );

    if (!organization) {
      this.error(
        `No organization called "${flags.org}". ` +
          `Available: ${organizations.map((org) => org.name).join(", ")}.`,
      );
    }

    const members = await whileWaiting("Reading members...", cloud.orgMembers(organization.id));
    const rows = membershipRows(members);

    this.log("");
    this.log(`  ${chalk.bold(organization.name)} ${chalk.dim(`- you are ${organization.role}`)}`);
    this.log("");

    if (rows.length === 0) {
      this.log(chalk.dim("  No members."));
      this.log("");
      return;
    }

    const width = Math.max(...rows.map((row) => row.email.length));
    for (const row of rows) {
      const elevated = row.role === "owner" || row.role === "admin";
      this.log(
        `  ${row.email.padEnd(width)}  ${elevated ? chalk.yellow(row.role) : chalk.dim(row.role)}`,
      );
    }

    this.log("");
    this.log(chalk.dim("  Owners and admins have admin rights on every app in the organization."));
    this.log("");
  }
}
