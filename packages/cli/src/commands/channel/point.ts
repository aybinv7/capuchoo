import { Args, Flags } from "@oclif/core";
import chalk from "chalk";
import { BaseCommand } from "../../base-command.js";
import { withJsonFailure } from "../../cli/json-output.js";
import { confirm, isInteractive, whileWaiting } from "../../cli/prompts.js";
import { requireSession } from "../../cli/session.js";
import { eligibleChannels, selectPointTargets } from "../../delivery/point-targets.js";
import { HttpError } from "../../utils/http.js";

export default class ChannelPoint extends BaseCommand {
  static override description =
    "Deliver an already published release to a channel by moving its pointer; nothing is rebuilt";

  static override examples = [
    "<%= config.bin %> channel point prod-acme --version 2.4.0",
    "<%= config.bin %> channel point prod --version 2.4.0 --native 57",
    "<%= config.bin %> channel point prod-acme --native 57",
    '<%= config.bin %> channel point prod --version 2.3.1 --rollback --reason "crash on login"',
  ];

  static override args = {
    channel: Args.string({ required: true, description: "Channel to point, e.g. prod-acme" }),
  };

  static override flags = {
    version: Flags.string({
      description: "OTA bundle version to deliver",
    }),
    native: Flags.integer({
      description: "Native build number (versionCode) to deliver, alone or with --version",
    }),
    platform: Flags.string({ default: "android", options: ["android", "ios"] }),
    rollback: Flags.boolean({
      default: false,
      description: "Move to a lower version; devices accept the downgrade",
    }),
    reason: Flags.string({ description: "Why, recorded in the channel history" }),
    yes: Flags.boolean({ char: "y", default: false, description: "Do not ask for confirmation" }),
    json: Flags.boolean({ default: false, description: "Machine-readable output" }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ChannelPoint);

    await withJsonFailure(
      flags.json,
      (line) => this.log(line),
      async () => {
        const { project, cloud } = requireSession();
        const [channel, artefacts] = await whileWaiting(
          "Reading the channel and its releases...",
          Promise.all([
            cloud.requireChannel(project.cloudAppId, args.channel),
            cloud.artefacts(project.cloudAppId),
          ]),
        );

        const targets = selectPointTargets({
          artefacts,
          channel,
          platform: flags.platform as "android" | "ios",
          version: flags.version,
          nativeCode: flags.native,
        });

        const moving = [
          targets.bundle ? `bundle ${targets.bundle.version_name}` : null,
          targets.native
            ? `native ${targets.native.version_name} (build ${targets.native.version_code})`
            : null,
        ]
          .filter(Boolean)
          .join(" and ");

        if (!flags.yes && !flags.json && isInteractive()) {
          const verb = flags.rollback ? "Roll back" : "Point";
          const proceed = await confirm(`${verb} "${channel.name}" to ${moving}?`, {
            default: true,
          });
          if (!proceed) this.error("Cancelled. Nothing was changed.");
        }

        const updated = await cloud
          .pointChannel(channel.id, {
            ...(targets.bundle ? { bundle_id: targets.bundle.id } : {}),
            ...(targets.native ? { native_id: targets.native.id } : {}),
            ...(flags.rollback ? { rollback: true } : {}),
            ...(flags.reason ? { reason: flags.reason } : {}),
          })
          .catch((error: unknown) => {
            const eligible = eligibleChannels(targets);
            if (error instanceof HttpError && eligible) {
              error.message += `\n  It may be pointed at: ${eligible.join(", ") || "no channel yet"}.`;
            }
            throw error;
          });

        if (flags.json) {
          this.log(
            JSON.stringify(
              {
                ok: true,
                channel: updated,
                bundle: targets.bundle?.id ?? null,
                native: targets.native?.id ?? null,
              },
              null,
              2,
            ),
          );
          return;
        }

        this.log("");
        this.log(
          `  ${chalk.green(flags.rollback ? "Rolled back" : "Pointed")} ${chalk.bold(channel.name)} to ${moving}`,
        );
        if (updated.paused)
          this.log(chalk.yellow("  The channel is paused: nothing is served until it resumes."));
        this.log("");
      },
    );
  }
}
