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
    "<%= config.bin %> <%= command.id %> -c dev --apk app/build/outputs/apk/release/app-release.apk",
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
      options: ["debug", "release"],
      description:
        "Gradle variant to assemble. Defaults to release; debug is refused on prod and client channels",
    }),
    flavor: Flags.string({
      description: "Gradle product flavour to build, when the project has more than one",
    }),
    apk: Flags.string({
      description:
        "Publish this APK instead of building one: any Android app, Capacitor or native Kotlin/Java. Its version is the one compiled into it",
    }),
    "allow-unsigned": Flags.boolean({
      default: false,
      description:
        "Publish a release build with no signature, to a dev channel only. Android will refuse to install it.",
    }),
    "allow-cert-change": Flags.boolean({
      default: false,
      description:
        "Publish an APK signed with a different certificate than the previous release. Installed devices cannot upgrade to it.",
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
