import { ENVIRONMENTS, versionEnv, type Environment } from "@capuchoo/core";
import { Flags } from "@oclif/core";
import chalk from "chalk";
import { readVersionCodes, resolveFlavour, writeVersionCodes } from "../../pipeline/flavour.js";
import { readAppVersion, requireProjectConfig } from "../../utils/config.js";
import { nextVersionCode } from "@capuchoo/core";
import { BaseCommand } from "../../base-command.js";

export default class VersionSync extends BaseCommand {
  static override description =
    "Show, or advance, the version and build number used for each flavour";

  static override examples = [
    "<%= config.bin %> version sync",
    "<%= config.bin %> version sync --bump --environment staging",
  ];

  static override flags = {
    bump: Flags.boolean({
      char: "b",
      default: false,
      description: "Increment the build number for the selected environments",
    }),
    environment: Flags.string({
      char: "e",
      options: [...ENVIRONMENTS],
      description: "Limit to one environment",
    }),
    json: Flags.boolean({ default: false, description: "Machine-readable output" }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(VersionSync);
    const appDir = process.cwd();

    const project = requireProjectConfig(appDir);
    const version = readAppVersion(appDir);

    const targets: Environment[] = flags.environment
      ? [flags.environment as Environment]
      : [...ENVIRONMENTS];

    let codes = readVersionCodes(appDir, project);
    if (flags.bump) {
      for (const environment of targets) {
        codes = nextVersionCode(codes, environment);
      }
      writeVersionCodes(appDir, project, codes);
    }

    const rows = targets.map((environment) => {
      const flavour = resolveFlavour(appDir, project, environment);
      return {
        environment,
        versionCode: codes[environment],
        envFile: flavour.config.envFile,
        // A flavour with no env file on disk cannot be built, and that is worth
        // saying here rather than at deploy time.
        present: flavour.envFile !== null,
        variables: versionEnv(version, codes[environment]),
      };
    });

    if (flags.json) {
      this.log(JSON.stringify({ version, flavours: rows }, null, 2));
      return;
    }

    this.log("");
    this.log(`  version ${chalk.green(version)} ${chalk.dim("(from package.json)")}`);
    this.log("");

    for (const row of rows) {
      const marker = row.present ? chalk.green("*") : chalk.red("!");
      this.log(
        `  ${marker} ${row.environment.padEnd(8)} build ${String(row.versionCode).padEnd(5)} ${chalk.dim(row.envFile)}`,
      );
      if (!row.present) {
        this.log(chalk.dim(`      missing - this flavour cannot be built`));
      }
    }

    this.log("");
    // The old `version sync` command rewrote these three variables into each
    // committed .env file. It no longer writes to them at all - the deploy
    // pipeline passes the values as environment variables, so nothing in the
    // working tree changes. Only version-code.json is persisted.
    this.log(
      chalk.dim(
        "  These values are passed to the build as VITE_APP_VERSION, VERSION_CODE\n" +
          "  and BUILD_NUMBER. The env files are read, never written.",
      ),
    );
    if (flags.bump) {
      this.log(chalk.dim(`  ${project.versionCodeFile} updated.`));
    }
    this.log("");
  }
}
