import { normaliseProjectConfig, type ProjectConfig } from "@capuchoo/core";
import { Flags } from "@oclif/core";
import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";
import { BaseCommand } from "../base-command.js";
import { planUnlink, stripUpdateLink, type UnlinkAction } from "../cli/unlink-plan.js";
import { askText, confirm, isInteractive, log } from "../cli/prompts.js";
import { CloudClient } from "../services/cloud.js";
import { SIGNING_KEY_FILE } from "../signing/release-key.js";
import {
  projectConfigPath,
  readGlobalConfig,
  readProjectConfig,
  resolveCredentials,
  writeGlobalConfig,
} from "../utils/config.js";

interface EnvChange {
  file: string;
  absolute: string;
  content: string;
}

/**
 * Undoes `init` in this directory, so the next `init` starts from nothing: the server link in
 * .capuchoo/project.json and the two update variables it wrote into each flavour env file. The
 * app's code, packages and its own update settings are left alone. The server app, the signing
 * key and this machine's sign-in go only when asked for.
 */
export default class Unlink extends BaseCommand {
  static override description =
    "Undo init here: remove the server link, optionally delete the app on the server";

  static override examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --delete-app --sign-out",
    "<%= config.bin %> <%= command.id %> --dry-run",
  ];

  static override flags = {
    "delete-app": Flags.boolean({
      default: false,
      description: "Also delete the linked app on the server, with its channels and releases",
    }),
    "sign-out": Flags.boolean({
      default: false,
      description: "Also forget this machine's API key and server address",
    }),
    "forget-signing-key": Flags.boolean({
      default: false,
      description:
        "Also delete .capuchoo/signing-key.pem. Installed builds will refuse releases signed by a new key",
    }),
    "dry-run": Flags.boolean({
      default: false,
      description: "Show what would change, change nothing",
    }),
    yes: Flags.boolean({ char: "y", default: false, description: "Skip the confirmations" }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Unlink);
    const appDir = process.cwd();
    const project = readProjectConfig(appDir);
    const credentials = resolveCredentials();
    const envChanges = project ? this.envChanges(appDir, project) : [];
    const keyFile = path.join(appDir, SIGNING_KEY_FILE);

    const actions = planUnlink(
      {
        linked: Boolean(project),
        appLabel: project ? project.appId : null,
        envFilesWithLink: envChanges.map((change) => change.file),
        hasSigningKey: fs.existsSync(keyFile),
        signedIn: Boolean(readGlobalConfig().apiKey),
      },
      {
        deleteApp: flags["delete-app"],
        signOut: flags["sign-out"],
        forgetSigningKey: flags["forget-signing-key"],
      },
    );

    if (actions.length === 0) {
      this.log(chalk.dim("  Nothing to undo: this directory is not linked to a Capuchoo server."));
      return;
    }

    this.log("");
    for (const action of actions) this.log(`  ${this.bullet(action)} ${action.description}`);
    this.log("");
    if (flags["delete-app"] && !project)
      log.warn("--delete-app ignored: this directory is not linked to an app.");

    if (flags["dry-run"]) {
      this.log(chalk.dim("  Dry run: nothing was changed."));
      return;
    }

    const destructive = actions.filter((action) => action.destructive);
    if (!flags.yes && !isInteractive())
      this.error("Refusing to unlink unattended. Review the list above, then pass --yes.");
    if (!flags.yes) {
      const proceed = await confirm(
        destructive.length > 0
          ? "Apply these changes, including what cannot be undone?"
          : "Apply these changes?",
        { default: false, flag: "--yes" },
      );
      if (!proceed) {
        this.log(chalk.dim("  Nothing was changed."));
        return;
      }
    }

    if (actions.some((action) => action.id === "delete-app") && project) {
      if (!credentials)
        this.error(
          "Deleting the app needs a sign-in. Run capuchoo auth login, or drop --delete-app.",
        );
      if (!flags.yes) {
        const typed = await askText(`Type ${project.appId} to delete it on the server`, {
          flag: "--yes",
        });
        if (typed.trim() !== project.appId)
          this.error("That was not the bundle identifier. Nothing was changed.");
      }
      await new CloudClient(credentials.endpoint, credentials.apiKey).deleteApp(project.cloudAppId);
      this.log(`  ${chalk.green("✓")} Deleted ${project.appId} on ${credentials.endpoint}`);
    }

    for (const change of envChanges) {
      fs.writeFileSync(change.absolute, change.content, "utf8");
      this.log(`  ${chalk.green("✓")} ${change.file}`);
    }
    if (project) {
      fs.rmSync(projectConfigPath(appDir), { force: true });
      this.log(`  ${chalk.green("✓")} Removed .capuchoo/project.json`);
    }
    if (actions.some((action) => action.id === "signing-key")) {
      fs.rmSync(keyFile, { force: true });
      this.log(`  ${chalk.green("✓")} Deleted ${SIGNING_KEY_FILE}`);
    }
    if (actions.some((action) => action.id === "sign-out")) {
      writeGlobalConfig({});
      this.log(`  ${chalk.green("✓")} Signed out and forgot the server address`);
      if (process.env.CAPUCHOO_API_KEY)
        log.warn("CAPUCHOO_API_KEY is set in this environment and still takes precedence.");
    }

    this.log("");
    this.log(chalk.dim(`  Run capuchoo init to link this app again.`));
    this.log("");
  }

  private bullet(action: UnlinkAction): string {
    return action.destructive ? chalk.red("✗") : chalk.yellow("−");
  }

  private envChanges(appDir: string, raw: ProjectConfig): EnvChange[] {
    const project = normaliseProjectConfig(raw);
    const seen = new Set<string>();
    const changes: EnvChange[] = [];
    for (const flavour of Object.values(project.flavours)) {
      if (seen.has(flavour.envFile)) continue;
      seen.add(flavour.envFile);
      const absolute = path.join(appDir, flavour.envFile);
      if (!fs.existsSync(absolute)) continue;
      const stripped = stripUpdateLink(fs.readFileSync(absolute, "utf8"));
      if (stripped.content !== null)
        changes.push({ file: flavour.envFile, absolute, content: stripped.content });
    }
    return changes;
  }
}
