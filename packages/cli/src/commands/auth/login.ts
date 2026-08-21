import { input, password } from "@inquirer/prompts";
import { Flags } from "@oclif/core";
import chalk from "chalk";
import ora from "ora";
import { CloudClient } from "../../services/cloud.js";
import { readGlobalConfig, updateGlobalConfig } from "../../utils/config.js";
import { BaseCommand } from "../../base-command.js";

const DEFAULT_ENDPOINT = "https://capuchoo-back.onrender.com";

export default class AuthLogin extends BaseCommand {
  static override description = "Store an API key for the Capucho backend";

  static override examples = [
    "<%= config.bin %> auth login",
    "<%= config.bin %> auth login --endpoint https://capucho.internal --api-key cap_...",
  ];

  static override flags = {
    "api-key": Flags.string({
      char: "k",
      description: "API key from Settings > API Keys in the dashboard",
    }),
    endpoint: Flags.string({ char: "e", description: "Backend base URL" }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(AuthLogin);
    await AuthLogin.performLogin(flags.endpoint, flags["api-key"]);
  }

  /**
   * Shared with `capuchoo init`, which offers to log in when it finds no
   * credentials.
   *
   * Throws on failure rather than calling `this.error`, so the caller decides
   * whether a failed login ends the process or just ends the login step.
   */
  static async performLogin(flagEndpoint?: string, flagApiKey?: string): Promise<void> {
    const existing = readGlobalConfig();

    const endpoint = (
      flagEndpoint ??
      (await input({
        message: "Backend URL",
        default: existing.endpoint ?? DEFAULT_ENDPOINT,
        validate: (value) =>
          /^https?:\/\/.+/.test(value.trim()) || "Must start with http:// or https://",
      }))
    )
      .trim()
      .replace(/\/+$/, "");

    let apiKey = flagApiKey;
    if (!apiKey) {
      process.stderr.write(
        chalk.dim(`\n  Create a key under Settings > API Keys at ${endpoint}\n\n`),
      );
      apiKey = await password({
        message: "API key",
        // Only a length check. The previous version required the key to start
        // with "cap_", which is a server-side format decision the CLI has no
        // business enforcing - a rotated prefix would have locked users out.
        validate: (value) => value.trim().length >= 16 || "That key looks too short",
      });
    }

    apiKey = apiKey.trim();

    const spinner = ora({ text: "Verifying", stream: process.stderr }).start();
    const profile = await new CloudClient(endpoint, apiKey).whoami();

    if (!profile) {
      spinner.fail("Those credentials were rejected");
      throw new Error(`${endpoint} did not accept that API key. Check the key and the URL.`);
    }

    spinner.succeed(`Signed in as ${profile.user.email}`);

    // Only what is needed to authenticate, plus who it belongs to. The old
    // implementation also wrote the full app and organization lists, which went
    // stale immediately - and `auth whoami` then read fields that `auth login`
    // never actually saved, so it always reported no organizations.
    updateGlobalConfig({
      endpoint,
      apiKey,
      user: { id: profile.user.id, email: profile.user.email },
      authenticatedAt: new Date().toISOString(),
    });
  }
}
