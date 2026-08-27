import chalk from "chalk";
import { BaseCommand } from "../base-command.js";
import { buildMenu, menuSize, type Menu as MenuShape, type MenuCommand } from "../cli/menu.js";
import fs from "node:fs";
import path from "node:path";
import { PromptCancelled, isInteractive, selectOne } from "../cli/prompts.js";
import {
  hiddenCommands,
  isBlocked,
  labelFor,
  resolveOnboarding,
  type OnboardingFacts,
  type OnboardingState,
} from "../cli/onboarding.js";
import { readProjectConfig, resolveCredentials } from "../utils/config.js";

const BACK = Symbol("back");
const QUIT = Symbol("quit");

type TopLevel = { kind: "command"; command: MenuCommand } | { kind: "topic"; topic: string };

/**
 * What `capuchoo` does with no arguments.
 *
 * It printed help and exited, so finding anything meant typing a topic, reading
 * the output, typing a subcommand, and getting `command channeml not found` for
 * a typo. This is a loop: pick, run, come back.
 *
 * Non-interactive callers get the help text and exit 0 instead of a prompt that
 * can never be answered. A CI job that runs `capuchoo` by mistake must not hang
 * forever waiting on a keystroke.
 */
export default class Menu extends BaseCommand {
  static override description = "Browse and run commands interactively";

  static override examples = ["<%= config.bin %>", "<%= config.bin %> menu"];

  async run(): Promise<void> {
    if (!isInteractive()) {
      await this.config.runCommand("help", []);
      return;
    }

    // Local only, so the menu appears at once. Channel state needs the network
    // against a backend that sleeps, and is filled in lazily below.
    const facts = this.localFacts();
    const state = resolveOnboarding(facts);

    const menu = buildMenu({
      commands: this.config.commands.filter((command) => !hiddenCommands(facts).has(command.id)),
      topics: this.config.topics,
    });

    this.showHeader(menu, facts, state);

    try {
      await this.loop(menu, facts, state);
    } catch (error) {
      // Ctrl+C at a menu is how you leave, not a crash.
      if (error instanceof PromptCancelled) return;
      throw error;
    }
  }

  /**
   * Context before the first prompt.
   *
   * Which app the directory is linked to is the thing you most want confirmed
   * before running a deploy, and it is cheap - `readProjectConfig` reads a local
   * file. Nothing here touches the network: the menu must appear instantly, and
   * the backend is on a host that can take fifteen seconds to wake.
   */
  private showHeader(menu: MenuShape, facts: OnboardingFacts, state: OnboardingState): void {
    const project = readProjectConfig(process.cwd());

    this.log("");
    this.log(`  ${chalk.bold("Capuchoo")} ${chalk.dim(this.config.version)}`);
    this.log(
      project
        ? `  ${chalk.dim("linked to")} ${project.appName} ${chalk.dim(`(${project.appId})`)}`
        : facts.signedIn
          ? `  ${chalk.dim("not linked yet")}`
          : `  ${chalk.dim("not signed in")}`,
    );

    if (state.next) {
      this.log("");
      this.log(`  ${chalk.green("Next")}  ${chalk.bold(state.next.label)}`);
      this.log(`        ${chalk.dim(state.next.why)}`);
    }

    this.log("");
    this.log(`  ${chalk.dim(`${menuSize(menu)} commands available`)}`);
    this.log("");
  }

  /** Everything knowable without a request. */
  private localFacts(): OnboardingFacts {
    const appDir = process.cwd();
    const manifestPath = path.join(appDir, "package.json");
    const inAppDirectory = fs.existsSync(manifestPath);

    let updaterInstalled = false;
    if (inAppDirectory) {
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        };
        updaterInstalled = Boolean(
          { ...manifest.dependencies, ...manifest.devDependencies }["@capuchoo/updater"],
        );
      } catch {
        // A malformed manifest is the app's problem, not the menu's.
      }
    }

    return {
      signedIn: resolveCredentials() !== null,
      inAppDirectory,
      linked: readProjectConfig(appDir) !== null,
      updaterInstalled,
    };
  }

  private async loop(
    menu: MenuShape,
    facts: OnboardingFacts,
    state: OnboardingState,
  ): Promise<void> {
    for (;;) {
      const choice = await this.chooseTopLevel(menu, facts, state);
      if (choice === QUIT) return;

      const command =
        choice.kind === "command" ? choice.command : await this.chooseInTopic(menu, choice.topic);

      // Back out of a topic without running anything.
      if (command === BACK) continue;

      await this.runAndReturn(command);
    }
  }

  /** The recommended step first, then everything else. */
  private async chooseTopLevel(
    menu: MenuShape,
    facts: OnboardingFacts,
    state: OnboardingState,
  ): Promise<TopLevel | typeof QUIT> {
    const all = [...menu.commands, ...menu.topics.flatMap((topic) => topic.commands)];
    const recommended = state.next
      ? all.find((command) => command.id === state.next!.command)
      : undefined;

    const entry = (command: MenuCommand) => ({
      value: { kind: "command", command } as TopLevel,
      label: labelFor(command.id, facts) ?? command.label,
      hint: command.description,
    });

    // Signed out, the whole menu is noise: nothing else can succeed.
    if (isBlocked(state) && recommended) {
      return selectOne<TopLevel | typeof QUIT>(
        state.next!.label,
        [
          { ...entry(recommended), label: `${recommended.label} ${chalk.green("(next)")}` },
          { value: QUIT, label: "Quit", hint: "" },
        ],
        "--help",
      );
    }

    return selectOne<TopLevel | typeof QUIT>(
      "What would you like to do?",
      [
        ...(recommended
          ? [{ ...entry(recommended), label: `${recommended.label} ${chalk.green("(next)")}` }]
          : []),
        ...menu.commands
          .filter((command) => command.id !== recommended?.id)
          .map((command) => entry(command)),
        ...menu.topics.map((topic) => ({
          value: { kind: "topic", topic: topic.name } as TopLevel,
          label: `${topic.name} ${chalk.dim("›")}`,
          hint: topic.description,
        })),
        { value: QUIT, label: "Quit", hint: "" },
      ],
      "--help",
    );
  }

  private async chooseInTopic(menu: MenuShape, name: string): Promise<MenuCommand | typeof BACK> {
    const topic = menu.topics.find((entry) => entry.name === name);
    if (!topic) return BACK;

    return selectOne<MenuCommand | typeof BACK>(
      topic.description,
      [
        ...topic.commands.map((command) => ({
          value: command,
          label: command.label,
          hint: command.description,
        })),
        { value: BACK, label: "← Back", hint: "" },
      ],
      "--help",
    );
  }

  /**
   * Runs a command and returns to the menu.
   *
   * A command's own failure is reported and swallowed rather than ending the
   * session: a failed deploy is exactly the moment you want to run `doctor`
   * next, and being dropped back to the shell to retype `npx capuchoo` is the
   * friction this command exists to remove.
   */
  private async runAndReturn(command: MenuCommand): Promise<void> {
    this.log("");
    this.log(chalk.dim(`  ${this.config.bin} ${command.id.replaceAll(":", " ")}`));
    this.log("");

    try {
      await this.config.runCommand(command.id, []);
    } catch (error) {
      if (error instanceof PromptCancelled) {
        this.log(chalk.dim("\n  Cancelled."));
        return;
      }

      const message = error instanceof Error ? error.message : String(error);
      // oclif's own exit signal, thrown by this.exit(0) on success.
      if (/EEXIT: 0/.test(message)) return;

      this.log("");
      this.log(`  ${chalk.red("✗")} ${message.split("\n")[0]}`);
    }

    this.log("");
  }
}
