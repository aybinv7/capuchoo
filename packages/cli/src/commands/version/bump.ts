import {
  ENVIRONMENTS,
  bumpVersion,
  nextVersionCode,
  type BumpType,
  type Environment,
} from "@capucho/core";
import { Args, Flags } from "@oclif/core";
import chalk from "chalk";
import { BaseCommand } from "../../base-command.js";
import { readVersionCodes, writeVersionCodes } from "../../pipeline/flavour.js";
import {
  readAppVersion,
  requireProjectConfig,
  writeAppVersion,
} from "../../utils/config.js";

export default class VersionBump extends BaseCommand {
  static override description =
    "Raise the app's semantic version, and optionally an environment's build number";

  static override examples = [
    "<%= config.bin %> version bump patch",
    "<%= config.bin %> version bump minor --environment staging",
  ];

  // Declared with `Args` rather than a bare object. The previous version used a
  // plain object cast `as const` and needed two @ts-ignore comments to compile,
  // which also meant the option list was never actually enforced.
  static override args = {
    type: Args.string({
      description: "Which part of the version to raise",
      options: ["major", "minor", "patch"],
      required: true,
    }),
  };

  static override flags = {
    environment: Flags.string({
      char: "e",
      options: [...ENVIRONMENTS],
      description: "Also increment this environment's native build number",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(VersionBump);
    const appDir = process.cwd();
    const project = requireProjectConfig(appDir);

    const previous = readAppVersion(appDir);
    const next = bumpVersion(previous, args.type as BumpType);

    writeAppVersion(appDir, next);
    this.log(`  version  ${chalk.dim(previous)} -> ${chalk.green(next)}`);

    if (flags.environment) {
      const environment = flags.environment as Environment;
      const codes = nextVersionCode(readVersionCodes(appDir, project), environment);
      writeVersionCodes(appDir, project, codes);
      this.log(
        `  build    ${environment} -> ${chalk.green(String(codes[environment]))}`,
      );
    }

    this.log("");
    // No git tag, and no commit. The old command shelled out to
    // `npm version <type> --no-git-tag-version`, which in a workspace bumped
    // whichever package.json was nearest the process directory. Tagging stays
    // with git and CI, where the release actually happens.
    this.log(
      chalk.dim("  Nothing was committed or tagged. Commit the change yourself."),
    );
  }
}
