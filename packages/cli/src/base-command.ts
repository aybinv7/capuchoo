import { Command } from "@oclif/core";
import chalk from "chalk";
import { HttpError } from "./utils/http.js";

/**
 * Base class for every Capuchoo command.
 *
 * Two jobs, both about failure. oclif's default renderer prints the error class
 * name and a stack-shaped indent, which for a deploy tool buries the one line
 * that matters. And an aborted prompt raises `ExitPromptError`, which used to
 * surface as an unhandled crash when a developer pressed Ctrl-C.
 */
export abstract class BaseCommand extends Command {
  protected override async catch(error: Error & { exitCode?: number }): Promise<never> {
    // Ctrl-C at a prompt is a decision, not a fault.
    if (error.name === "ExitPromptError" || error.name === "AbortPromptError") {
      process.stderr.write(chalk.dim("\nCancelled.\n"));
      process.exit(130); // 128 + SIGINT
    }

    if (error instanceof HttpError) {
      process.stderr.write(`\n${chalk.red("✗")} ${error.message}\n`);

      // Say what the status actually means for the caller, rather than leaving
      // them to interpret a bare number.
      const hint = describeStatus(error.status);
      if (hint) process.stderr.write(chalk.dim(`  ${hint}\n`));
      process.stderr.write("\n");
      process.exit(1);
    }

    // Multi-line messages are already formatted by the thrower (validation
    // reports a bulleted list, for instance); do not re-wrap them.
    const message = error.message ?? String(error);
    process.stderr.write(`\n${chalk.red("✗")} ${message}\n\n`);
    process.exit(typeof error.exitCode === "number" ? error.exitCode : 1);
  }
}

function describeStatus(status: number): string | null {
  switch (status) {
    case 401:
    case 403: {
      return "The API key was rejected, or it is not scoped to this app. Check `capuchoo auth whoami`.";
    }
    case 404: {
      return "The server has no record with that id. If this app was deleted or recreated, re-run `capuchoo init`.";
    }
    case 409: {
      return "That version already exists on this channel. Bump the version, or deactivate the existing release.";
    }
    case 413: {
      return "The artefact is larger than the server accepts.";
    }
    case 429: {
      return "Rate limited. Wait and retry.";
    }
    default: {
      return status >= 500
        ? "The server failed. This is not something the CLI can fix - retry, then check the backend logs."
        : null;
    }
  }
}
