import { Flags } from "@oclif/core";
import chalk from "chalk";
import { BaseCommand } from "../../base-command.js";
import { withJsonFailure } from "../../cli/json-output.js";
import { whileWaiting } from "../../cli/prompts.js";
import { requireSession } from "../../cli/session.js";
import { releaseRows } from "../../delivery/release-rows.js";

export default class ReleaseList extends BaseCommand {
  static override description =
    "List published bundles and native builds, or only what one channel has served";

  static override examples = [
    "<%= config.bin %> release list",
    "<%= config.bin %> release list --channel prod-acme --json",
  ];

  static override flags = {
    channel: Flags.string({ char: "c", description: "Only releases this channel has served" }),
    limit: Flags.integer({ default: 30, min: 1, description: "How many to show" }),
    json: Flags.boolean({ default: false, description: "Machine-readable output" }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ReleaseList);

    await withJsonFailure(
      flags.json,
      (line) => this.log(line),
      async () => {
        const { project, cloud } = requireSession();
        const [artefacts, channel] = await whileWaiting(
          "Reading releases...",
          Promise.all([
            cloud.artefacts(project.cloudAppId),
            flags.channel ? cloud.requireChannel(project.cloudAppId, flags.channel) : null,
          ]),
        );

        const rows = releaseRows(artefacts, channel).slice(0, flags.limit);

        if (flags.json) {
          this.log(JSON.stringify(rows, null, 2));
          return;
        }

        this.log("");
        if (rows.length === 0) this.log(chalk.dim("  Nothing published yet."));
        for (const row of rows) {
          const version = row.versionCode ? `${row.version} (${row.versionCode})` : row.version;
          this.log(
            [
              `  ${row.current ? chalk.green("*") : " "}`,
              row.kind.padEnd(6),
              version.padEnd(18),
              row.platform.padEnd(8),
              (row.flavour ?? "-").padEnd(8),
              row.signed ? "signed  " : chalk.dim("unsigned"),
              chalk.dim(row.createdAt.slice(0, 10)),
              chalk.dim(row.channels.join(", ")),
            ].join(" "),
          );
        }
        if (channel) this.log(chalk.dim(`\n  * served by "${channel.name}" now`));
        this.log("");
      },
    );
  }
}
