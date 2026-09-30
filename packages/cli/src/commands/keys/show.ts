import { Flags } from "@oclif/core";
import chalk from "chalk";
import { BaseCommand } from "../../base-command.js";
import { flavourKeyReport, publicKeyLine } from "../../signing/flavour-keys.js";
import { loadReleaseKey, SIGNING_KEY_ENV, SIGNING_KEY_FILE } from "../../signing/release-key.js";
import { requireProjectConfig } from "../../utils/config.js";

const STATE_LABEL = {
  matches: chalk.green("matches"),
  missing: chalk.yellow("not set"),
  different: chalk.red("different key"),
  "no-file": chalk.dim("no file"),
} as const;

export default class KeysShow extends BaseCommand {
  static override description =
    "Show the release signing key's fingerprint and whether each flavour bakes its public key";

  static override flags = {
    json: Flags.boolean({ default: false, description: "Machine-readable output" }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(KeysShow);
    const appDir = process.cwd();
    const project = requireProjectConfig(appDir);

    const key = await loadReleaseKey(appDir);
    if (!key) {
      this.error(
        `No signing key: neither ${SIGNING_KEY_ENV} nor ${SIGNING_KEY_FILE} exists. Run capuchoo keys init.`,
      );
    }

    const flavours = flavourKeyReport(appDir, project, key.publicKey);

    if (flags.json) {
      this.log(
        JSON.stringify(
          {
            fingerprint: key.fingerprint,
            publicKey: key.publicKey,
            source: key.source,
            flavours,
          },
          null,
          2,
        ),
      );
      return;
    }

    this.log("");
    this.log(`  fingerprint  ${chalk.bold(key.fingerprint)}`);
    this.log(`  source       ${key.source === "environment" ? SIGNING_KEY_ENV : SIGNING_KEY_FILE}`);
    this.log("");
    for (const flavour of flavours) {
      this.log(`  ${flavour.envFile.padEnd(32)} ${STATE_LABEL[flavour.state]}`);
    }
    this.log("");
    this.log(`  ${publicKeyLine(key.publicKey)}`);
    this.log("");
  }
}
