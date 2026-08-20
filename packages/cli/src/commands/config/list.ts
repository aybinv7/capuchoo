import { Flags } from "@oclif/core";
import chalk from "chalk";
import {
  globalConfigPath,
  projectConfigPath,
  readGlobalConfig,
  readProjectConfig,
  resolveCredentials,
} from "../../utils/config.js";
import { detectToolchain, lookupTools } from "../../pipeline/toolchain.js";
import { resolveFlavour } from "../../pipeline/flavour.js";
import { ENVIRONMENTS, normaliseProjectConfig } from "@capucho/core";
import { BaseCommand } from "../../base-command.js";

export default class ConfigList extends BaseCommand {
  static override description =
    "Show the resolved configuration, and which build tools were found";

  static override flags = {
    json: Flags.boolean({ default: false, description: "Machine-readable output" }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ConfigList);
    const appDir = process.cwd();

    const globalConfig = readGlobalConfig();
    const credentials = resolveCredentials();
    const rawProject = readProjectConfig(appDir);
    const project = rawProject ? normaliseProjectConfig(rawProject) : null;
    const toolchain = detectToolchain(appDir);
    const tools = lookupTools(appDir);

    const flavours = project
      ? ENVIRONMENTS.map((environment) => {
          const flavour = resolveFlavour(appDir, project, environment);
          return {
            environment,
            envFile: flavour.config.envFile,
            envFilePresent: flavour.envFile !== null,
            trapezeConfig: flavour.config.trapezeConfig,
            trapezePresent: flavour.trapezeConfig !== null,
            assetsPresent: flavour.assetPath !== null,
          };
        })
      : [];

    const report = {
      endpoint: credentials?.endpoint ?? null,
      // Never printed. The whole point of this command is to be safe to paste
      // into an issue.
      authenticated: Boolean(credentials),
      credentialSource: credentials?.source ?? null,
      account: globalConfig.user?.email ?? null,
      project: project
        ? {
            appId: project.appId,
            cloudAppId: project.cloudAppId,
            appName: project.appName,
            configVersion: project.version,
            webDir: project.webDir,
            androidDir: project.androidDir,
            versionCodeFile: project.versionCodeFile,
            build: project.build,
          }
        : null,
      flavours,
      toolchain: {
        workspaceRoot: toolchain.workspaceRoot,
        packageManager: toolchain.packageManager,
        vitePlus: toolchain.hasVitePlus,
      },
      tools: Object.fromEntries(
        Object.entries(tools).map(([name, tool]) => [
          name,
          { installed: tool.bin !== null, package: tool.packageName },
        ]),
      ),
      files: {
        global: globalConfigPath(),
        project: projectConfigPath(appDir),
      },
    };

    if (flags.json) {
      this.log(JSON.stringify(report, null, 2));
      return;
    }

    this.log("");
    this.log(chalk.bold("  account"));
    this.log(`    endpoint    ${report.endpoint ?? chalk.dim("not set")}`);
    this.log(
      `    signed in   ${report.authenticated ? chalk.green(report.account ?? "yes") : chalk.yellow("no")}` +
        (report.credentialSource ? chalk.dim(` via ${report.credentialSource}`) : ""),
    );

    this.log("");
    this.log(chalk.bold("  project"));
    if (!report.project) {
      this.log(chalk.yellow("    not initialised - run capucho init"));
    } else {
      this.log(`    app         ${report.project.appName}`);
      this.log(`    bundle id   ${report.project.appId}`);
      this.log(`    web dir     ${report.project.webDir}`);
      this.log(
        `    schema      v${report.project.configVersion}` +
          (report.project.configVersion < 2
            ? chalk.dim(" (defaults applied for the rest)")
            : ""),
      );
    }

    if (flavours.length > 0) {
      this.log("");
      this.log(chalk.bold("  flavours"));
      for (const flavour of flavours) {
        const mark = flavour.envFilePresent ? chalk.green("*") : chalk.red("!");
        const extras = [
          flavour.trapezePresent ? "trapeze" : null,
          flavour.assetsPresent ? "assets" : null,
        ].filter(Boolean);
        this.log(
          `    ${mark} ${flavour.environment.padEnd(8)} ${chalk.dim(flavour.envFile)}` +
            (extras.length > 0 ? chalk.dim(` + ${extras.join(", ")}`) : ""),
        );
      }
    }

    this.log("");
    this.log(chalk.bold("  toolchain"));
    this.log(`    manager     ${report.toolchain.packageManager}`);
    this.log(`    root        ${chalk.dim(report.toolchain.workspaceRoot)}`);
    for (const [name, tool] of Object.entries(report.tools)) {
      this.log(
        `    ${name.padEnd(11)} ${
          tool.installed ? chalk.green("found") : chalk.yellow("missing")
        } ${chalk.dim(tool.package)}`,
      );
    }

    this.log("");
    this.log(chalk.dim(`  global config   ${report.files.global}`));
    this.log(chalk.dim(`  project config  ${report.files.project}`));
    this.log("");
  }
}
