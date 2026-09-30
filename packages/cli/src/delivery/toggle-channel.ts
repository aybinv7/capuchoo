import chalk from "chalk";
import { withJsonFailure } from "../cli/json-output.js";
import { confirm, isInteractive } from "../cli/prompts.js";
import { requireSession } from "../cli/session.js";

export interface ToggleOptions {
  channel: string;
  action: "pause" | "resume";
  yes: boolean;
  json: boolean;
  log: (line: string) => void;
}

/** Shared by `channel pause` and `channel resume`: resolve, confirm a pause, call, report. */
export async function toggleChannel(options: ToggleOptions): Promise<void> {
  await withJsonFailure(options.json, options.log, async () => {
    const { project, cloud } = requireSession();
    const channel = await cloud.requireChannel(project.cloudAppId, options.channel);

    if (options.action === "pause" && !options.yes && !options.json && isInteractive()) {
      const proceed = await confirm(
        `Pause "${channel.name}"? Its devices get no update until it resumes.`,
        { default: false },
      );
      if (!proceed) throw new Error("Cancelled. Nothing was changed.");
    }

    const updated =
      options.action === "pause"
        ? await cloud.pauseChannel(channel.id)
        : await cloud.resumeChannel(channel.id);

    if (options.json) {
      options.log(JSON.stringify({ ok: true, channel: updated }, null, 2));
      return;
    }

    const verb = options.action === "pause" ? chalk.yellow("Paused") : chalk.green("Resumed");
    options.log(`\n  ${verb} ${chalk.bold(channel.name)}\n`);
  });
}
