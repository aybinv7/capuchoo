import { Flags } from "@oclif/core";
import { commonDeployFlags, executeDeploy, type DeployFlags } from "../../deploy/execute.js";
import { BaseCommand } from "../../base-command.js";

export default class DeployNative extends BaseCommand {
  static override description =
    "Build and publish a native binary (APK). Users install it through the OS.";

  static override examples = [
    "<%= config.bin %> <%= command.id %> --channel staging",
    "<%= config.bin %> <%= command.id %> -c production -v minor --type release",
    "<%= config.bin %> <%= command.id %> -c staging --type debug -y",
  ];

  static override flags = {
    ...commonDeployFlags,
    platform: Flags.string({
      char: "p",
      default: "android",
      options: ["android", "ios"],
      description: "Target platform",
    }),
    type: Flags.string({
      char: "t",
      default: "release",
      options: ["debug", "release"],
      description: "Gradle variant to assemble",
    }),
    "allow-unsigned": Flags.boolean({
      default: false,
      description: "Publish a release build with no signature. Android will refuse to install it.",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(DeployNative);
    await executeDeploy({
      kind: "native",
      command: this,
      flags: flags as unknown as DeployFlags,
    });
  }
}
