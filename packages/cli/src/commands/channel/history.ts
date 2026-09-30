import { Args, Flags } from "@oclif/core";
import chalk from "chalk";
import { BaseCommand } from "../../base-command.js";
import { withJsonFailure } from "../../cli/json-output.js";
import { whileWaiting } from "../../cli/prompts.js";
import { requireSession } from "../../cli/session.js";
import { describeMove } from "../../delivery/release-rows.js";

export default class ChannelHistory extends BaseCommand {
  static override description =
    "Show every pointer move, pause and rollback on a channel, newest first";

  static override args = {
    channel: Args.string({ required: true, description: "Channel to inspect" }),
  };

  static override flags = {
    limit: Flags.integer({ default: 20, min: 1, description: "How many moves to show" }),
    json: Flags.boolean({ default: false, description: "Machine-readable output" }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ChannelHistory);

    await withJsonFailure(
      flags.json,
      (line) => this.log(line),
      async () => {
        const { project, cloud } = requireSession();
        const channel = await cloud.requireChannel(project.cloudAppId, args.channel);
        const moves = await whileWaiting("Reading history...", cloud.channelHistory(channel.id));

        if (flags.json) {
          this.log(JSON.stringify(moves.slice(0, flags.limit), null, 2));
          return;
        }

        this.log("");
        if (moves.length === 0) {
          this.log(chalk.dim(`  "${channel.name}" has never pointed at anything.`));
        }
        for (const move of moves.slice(0, flags.limit)) this.log(`  ${describeMove(move)}`);
        if (moves.length > flags.limit) {
          this.log(chalk.dim(`  ... ${moves.length - flags.limit} older, see --limit`));
        }
        this.log("");
      },
    );
  }
}
