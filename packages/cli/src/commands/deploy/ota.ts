import { commonDeployFlags, executeDeploy, type DeployFlags } from "../../deploy/execute.js";
import { BaseCommand } from "../../base-command.js";

export default class DeployOta extends BaseCommand {
  static override description =
    "Publish a web bundle over the air. Does not change the installed binary.";

  static override examples = [
    "<%= config.bin %> <%= command.id %> --channel staging",
    "<%= config.bin %> <%= command.id %> -c production -v patch -n 'Fixes the invoice total'",
    "<%= config.bin %> <%= command.id %> -c staging --dry-run",
  ];

  static override flags = commonDeployFlags;

  async run(): Promise<void> {
    const { flags } = await this.parse(DeployOta);
    await executeDeploy({
      kind: "ota",
      command: this,
      flags: flags as unknown as DeployFlags,
    });
  }
}
