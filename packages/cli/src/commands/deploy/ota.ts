import { Flags } from "@oclif/core";
import { commonDeployFlags, executeDeploy, type DeployFlags } from "../../deploy/execute.js";
import { BaseCommand } from "../../base-command.js";

export default class DeployOta extends BaseCommand {
  static override description =
    "Publish a web bundle over the air. Does not change the installed binary.";

  static override examples = [
    "<%= config.bin %> <%= command.id %> --channel staging",
    "<%= config.bin %> <%= command.id %> -c production -v patch -n 'Fixes the invoice total'",
    "<%= config.bin %> <%= command.id %> -c staging --dry-run",
    "<%= config.bin %> <%= command.id %> -c dev --min-native 0.6.0",
  ];

  static override flags = {
    ...commonDeployFlags,
    /**
     * Native-only, so it lives here rather than in the shared flags: a binary
     * cannot require a version of itself.
     *
     * The column and the decision that reads it have existed all along -
     * `decideUpdate` returns `native-required` and the server answers with the
     * binary instead of the bundle - but nothing ever wrote it. No flag, no
     * request field. The one gate that stops a web bundle landing on a binary
     * too old to run it was unreachable from every supported path, which is a
     * feature that exists only in tests.
     */
    "min-native": Flags.string({
      description:
        "Native version this bundle needs. Devices below it are offered the binary instead.",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(DeployOta);
    await executeDeploy({
      kind: "ota",
      command: this,
      flags: flags as unknown as DeployFlags,
    });
  }
}
