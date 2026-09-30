import { Args, Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { toggleChannel } from "../../delivery/toggle-channel.js";

export default class ChannelResume extends BaseCommand {
  static override description = "Let a paused channel serve its releases again";

  static override args = {
    channel: Args.string({ required: true, description: "Channel to resume" }),
  };

  static override flags = {
    json: Flags.boolean({ default: false, description: "Machine-readable output" }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ChannelResume);
    await toggleChannel({
      channel: args.channel,
      action: "resume",
      yes: true,
      json: flags.json,
      log: (line) => this.log(line),
    });
  }
}
