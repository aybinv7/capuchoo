import { Args, Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { toggleChannel } from "../../delivery/toggle-channel.js";

export default class ChannelPause extends BaseCommand {
  static override description = "Stop a channel serving anything until it is resumed";

  static override args = {
    channel: Args.string({ required: true, description: "Channel to pause" }),
  };

  static override flags = {
    yes: Flags.boolean({ char: "y", default: false, description: "Do not ask for confirmation" }),
    json: Flags.boolean({ default: false, description: "Machine-readable output" }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ChannelPause);
    await toggleChannel({
      channel: args.channel,
      action: "pause",
      ...flags,
      log: (line) => this.log(line),
    });
  }
}
