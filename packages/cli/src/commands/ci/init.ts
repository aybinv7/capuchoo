import { Flags } from "@oclif/core";
import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";
import { BaseCommand } from "../../base-command.js";
import { describeReplacement } from "../../ci/file-diff.js";
import { parseClients, readGitlabTemplate, renderGitlabCi } from "../../ci/gitlab-template.js";
import { confirm, isInteractive, log } from "../../cli/prompts.js";
import { writeFileAtomic } from "../../utils/secure-file.js";

export default class CiInit extends BaseCommand {
  static override description =
    "Write a GitLab pipeline that publishes each release branch to its channel and delivers prod to each client by hand";

  static override examples = [
    "<%= config.bin %> ci init --gitlab",
    "<%= config.bin %> ci init --gitlab --clients acme,globex",
    "<%= config.bin %> ci init --gitlab --clients acme --output ../../.gitlab-ci.yml --yes",
  ];

  static override flags = {
    gitlab: Flags.boolean({ default: false, description: "Generate .gitlab-ci.yml" }),
    clients: Flags.string({
      description: "Comma-separated clients; each gets a manual deliver job to prod-<client>",
    }),
    output: Flags.string({ default: ".gitlab-ci.yml", description: "Where to write the pipeline" }),
    yes: Flags.boolean({
      char: "y",
      default: false,
      description: "Replace an existing file without asking",
    }),
    json: Flags.boolean({ default: false, description: "Machine-readable output" }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(CiInit);
    if (!flags.gitlab) this.error("Pass --gitlab. GitLab CI is the only provider this generates.");

    const clients = parseClients(flags.clients);
    const file = path.resolve(process.cwd(), flags.output);
    const next = renderGitlabCi(readGitlabTemplate(), this.config.version, clients);
    const before = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
    const relative = path.relative(process.cwd(), file) || flags.output;

    let state: "created" | "replaced" | "unchanged" = before === null ? "created" : "replaced";

    if (before !== null && before.replace(/\r\n/g, "\n") === next) {
      state = "unchanged";
    } else if (before !== null) {
      if (!flags.json) log.info(describeReplacement(relative, before, next));
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

    if (state !== "unchanged") writeFileAtomic(file, next);

    if (flags.json) {
      this.log(
        JSON.stringify(
          { ok: true, file: relative, state, clients, cliVersion: this.config.version },
          null,
          2,
        ),
      );
      return;
    }

    this.log("");
    this.log(
      `  ${state === "unchanged" ? chalk.dim("Up to date") : chalk.green(state === "created" ? "Created" : "Replaced")} ${relative}`,
    );
    for (const target of clients)
      this.log(chalk.dim(`  deliver:${target.client} -> ${target.channel}`));
    if (clients.length > 0) {
      this.log(
        chalk.dim(
          `\n  Each channel must exist: capuchoo channel create ${clients[0]!.channel} --client --base prod`,
        ),
      );
    }
    this.log(
      chalk.dim(
        "  Set CAPUCHOO_ENDPOINT, CAPUCHOO_API_KEY and CAPUCHOO_SIGNING_KEY as protected, masked variables.\n",
      ),
    );
  }
}
