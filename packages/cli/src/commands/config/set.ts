import { Args } from "@oclif/core";
import chalk from "chalk";
import { updateGlobalConfig, type GlobalConfig } from "../../utils/config.js";
import { BaseCommand } from "../../base-command.js";

/**
 * Only the keys that are genuinely a user preference.
 *
 * The old command accepted any key and wrote it to either file, which is how
 * `apiKey` ended up settable in a committed `project.json`. Credentials go
 * through `auth login`; the project identity goes through `init`.
 */
const SETTABLE = {
  endpoint: "Backend base URL",
  defaultChannel: "Channel used when --channel is omitted",
} satisfies Partial<Record<keyof GlobalConfig, string>>;

type SettableKey = keyof typeof SETTABLE;

export default class ConfigSet extends BaseCommand {
  static override description = "Set a user preference in ~/.capucho/config.json";

  static override examples = [
    "<%= config.bin %> config set endpoint https://capucho.internal",
    "<%= config.bin %> config set defaultChannel staging",
  ];

  static override args = {
    key: Args.string({
      description: "Preference to set",
      options: Object.keys(SETTABLE),
      required: true,
    }),
    value: Args.string({ description: "New value", required: true }),
  };

  async run(): Promise<void> {
    const { args } = await this.parse(ConfigSet);
    const key = args.key as SettableKey;
    let value = args.value.trim();

    if (key === "endpoint") {
      if (!/^https?:\/\/.+/.test(value)) {
        this.error("endpoint must start with http:// or https://");
      }
      value = value.replace(/\/+$/, "");
    }

    updateGlobalConfig({ [key]: value });
    this.log(chalk.green(`${key} = ${value}`));
  }
}
