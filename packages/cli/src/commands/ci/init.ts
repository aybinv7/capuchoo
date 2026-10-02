import { Flags } from "@oclif/core";
import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";
import { BaseCommand } from "../../base-command.js";
import type { CiTarget } from "../../ci/ci-target.js";
import { parseClients } from "../../ci/clients.js";
import { describeReplacement } from "../../ci/file-diff.js";
import { resolveGithubTarget } from "../../ci/github-target.js";
import { resolveGitlabTarget } from "../../ci/gitlab-target.js";
import { confirm, isInteractive, log } from "../../cli/prompts.js";
import { writeFileAtomic } from "../../utils/secure-file.js";

type WriteState = "created" | "replaced" | "unchanged";

export default class CiInit extends BaseCommand {
  static override description =
    "Write a GitHub Actions workflow or a GitLab pipeline that publishes each release branch to its channel and delivers prod to each client";

  static override examples = [
    "<%= config.bin %> ci init --github",
    "<%= config.bin %> ci init --github --clients acme,globex --default-branch main",
    "<%= config.bin %> ci init --gitlab",
    "<%= config.bin %> ci init --gitlab --clients acme,globex",
    "<%= config.bin %> ci init --gitlab --clients acme --output ../../.gitlab-ci.yml --yes",
  ];

  static override flags = {
    github: Flags.boolean({
      default: false,
      description: "Generate .github/workflows/capuchoo.yml",
    }),
    gitlab: Flags.boolean({ default: false, description: "Generate .gitlab-ci.yml" }),
    clients: Flags.string({
      description:
        "Comma-separated clients; each can be delivered prod on its prod-<client> channel",
    }),
    "dev-branch": Flags.string({
      default: "dev",
      description: "Branch that publishes to the dev channel",
    }),
    "staging-branch": Flags.string({
      default: "staging",
      description: "Branch that publishes to the staging channel",
    }),
    "default-branch": Flags.string({
      description:
        "GitHub only: the branch that rehearses against prod [default: origin/HEAD, else main]",
    }),
    "app-dir": Flags.string({
      description:
        "GitHub only: the app's directory from the repository root [default: the current directory's]",
    }),
    output: Flags.string({
      description:
        "Where to write the file [default: .github/workflows/capuchoo.yml at the repository root, or .gitlab-ci.yml here]",
    }),
    yes: Flags.boolean({
      char: "y",
      default: false,
      description: "Replace an existing file without asking",
    }),
    json: Flags.boolean({ default: false, description: "Machine-readable output" }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(CiInit);
    if (flags.github === flags.gitlab) {
      this.error("Pass exactly one of --github or --gitlab. Nothing was written.");
    }
    if (flags.gitlab && (flags["default-branch"] !== undefined || flags["app-dir"] !== undefined)) {
      this.error(
        "--default-branch and --app-dir apply to --github only. GitLab reads the default branch from the project, and APP_DIR is a variable in the generated file.",
      );
    }

    const cwd = process.cwd();
    const clients = this.attempt(() => parseClients(flags.clients));
    const input = {
      cwd,
      cliVersion: this.config.version,
      clients,
      devBranch: flags["dev-branch"],
      stagingBranch: flags["staging-branch"],
      output: flags.output,
    };

    let target: CiTarget;
    try {
      target = flags.github
        ? await resolveGithubTarget({
            ...input,
            defaultBranch: flags["default-branch"],
            appDir: flags["app-dir"],
          })
        : resolveGitlabTarget(input);
    } catch (error) {
      this.error(
        `Cannot generate the ${flags.github ? "workflow" : "pipeline"}: ${message(error)}`,
      );
    }

    const relative = path.relative(cwd, target.file) || target.file;
    if (!flags.json) for (const warning of target.warnings) log.warn(warning);

    const state = await this.write(target, relative, flags);

    if (flags.json) {
      this.log(
        JSON.stringify(
          {
            ok: true,
            provider: target.provider,
            file: relative,
            state,
            clients,
            cliVersion: this.config.version,
            ...target.details,
            warnings: target.warnings,
          },
          null,
          2,
        ),
      );
      return;
    }

    this.printSummary(state, relative, target.nextSteps);
  }

  private attempt<T>(work: () => T): T {
    try {
      return work();
    } catch (error) {
      this.error(message(error));
    }
  }

  private async write(
    target: CiTarget,
    relative: string,
    flags: { yes: boolean; json: boolean },
  ): Promise<WriteState> {
    const before = this.attempt(() =>
      fs.existsSync(target.file) ? fs.readFileSync(target.file, "utf8") : null,
    );
    if (before !== null && before.replace(/\r\n/g, "\n") === target.contents) return "unchanged";

    if (before !== null) {
      if (!flags.json) log.info(describeReplacement(relative, before, target.contents));
      if (!flags.yes) {
        if (!isInteractive()) {
          this.error(
            `${relative} exists and differs. Pass --yes to replace it. Nothing was written.`,
          );
        }
        const replace = await confirm(`Replace ${relative}?`, { default: false });
        if (!replace) this.error("Cancelled. Nothing was written.");
      }
    }

    try {
      writeFileAtomic(target.file, target.contents);
    } catch (error) {
      this.error(`Could not write ${relative}: ${message(error)}`);
    }
    return before === null ? "created" : "replaced";
  }

  private printSummary(state: WriteState, relative: string, nextSteps: string[]): void {
    const label =
      state === "unchanged"
        ? chalk.dim("Up to date")
        : chalk.green(state === "created" ? "Created" : "Replaced");
    this.log("");
    this.log(`  ${label} ${relative}`);
    for (const line of nextSteps) this.log(line ? chalk.dim(`  ${line}`) : "");
    this.log("");
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
