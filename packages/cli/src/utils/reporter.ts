import chalk from "chalk";
import ora, { type Ora } from "ora";

/**
 * Progress reporting for the deploy pipeline.
 *
 * The previous implementation drove a `cli-progress` MultiBar *and* an `ora`
 * spinner at the same time. Both write ANSI cursor-movement codes to the same
 * terminal, so they overwrote each other and the output was unreadable. It also
 * hard-coded `totalSteps = 9` while skipping steps conditionally, so the
 * numbers were wrong whenever a flag was passed, and `fail()` printed the
 * *previous* step's text as the failure.
 *
 * This reporter is told the steps it will actually run, up front, and owns a
 * single spinner.
 */

/** How a step ended, or that it started; emitted to `onStep` for live build status. */
export type StepStatus = "running" | "succeeded" | "failed" | "skipped";

export type StepListener = (id: string, status: StepStatus, message: string) => void;

export interface Step {
  /** Stable identifier, used in JSON output. */
  id: string;
  label: string;
}

export class Reporter {
  private spinner: Ora | null = null;
  private steps: Step[] = [];
  private index = -1;
  private readonly quiet: boolean;
  private startedAt = 0;
  private readonly onStep: StepListener | undefined;
  /** The step that is running and has not yet been reported as ended. */
  private active: string | null = null;

  constructor(options: { quiet?: boolean; onStep?: StepListener } = {}) {
    // JSON mode and non-interactive terminals get plain lines instead of a
    // spinner, so CI logs stay readable and machine output stays parseable.
    this.quiet = options.quiet ?? false;
    this.onStep = options.onStep;
  }

  private end(status: Exclude<StepStatus, "running">, message = ""): void {
    if (this.active === null) return;
    const id = this.active;
    this.active = null;
    this.onStep?.(id, status, message);
  }

  /** Declares the steps that will run. Skipped work is never listed. */
  plan(steps: Step[]): void {
    this.steps = steps;
    this.index = -1;
    this.startedAt = Date.now();
  }

  get total(): number {
    return this.steps.length;
  }

  /** Advances to the next planned step. */
  begin(id: string, detail?: string): void {
    this.settle();
    this.end("succeeded");

    const found = this.steps.findIndex((step) => step.id === id);
    this.index = found >= 0 ? found : this.index + 1;

    const step = this.steps[this.index];
    const label = detail ?? step?.label ?? id;
    this.active = id;
    this.onStep?.(id, "running", label);
    const text = `${chalk.dim(`[${this.index + 1}/${this.total}]`)} ${label}`;

    if (this.quiet) {
      process.stderr.write(`${text}\n`);
      return;
    }

    this.spinner = ora({ text, stream: process.stderr }).start();
  }

  /** Replaces the current step's text without advancing. */
  update(detail: string): void {
    if (!this.spinner) return;
    this.spinner.text = `${chalk.dim(`[${this.index + 1}/${this.total}]`)} ${detail}`;
  }

  /** Records a note under the current step. */
  note(message: string): void {
    const line = `      ${chalk.dim("-")} ${chalk.dim(message)}`;
    if (this.spinner) {
      this.spinner.stopAndPersist({
        symbol: chalk.green("✓"),
        text: this.spinner.text,
      });
      process.stderr.write(`${line}\n`);
      this.spinner = null;
    } else {
      process.stderr.write(`${line}\n`);
    }
  }

  /** Marks the current step done. */
  private settle(): void {
    if (!this.spinner) return;
    this.spinner.succeed();
    this.spinner = null;
  }

  /** Marks the current step as skipped, with the reason. */
  skip(reason: string): void {
    this.end("skipped", reason);
    if (this.spinner) {
      this.spinner.stopAndPersist({
        symbol: chalk.yellow("-"),
        text: `${this.spinner.text} ${chalk.dim(`(skipped: ${reason})`)}`,
      });
      this.spinner = null;
    } else {
      process.stderr.write(`${chalk.yellow("-")} skipped: ${reason}\n`);
    }
  }

  /** Warns without failing. */
  warn(message: string): void {
    const line = `${chalk.yellow("!")} ${message}`;
    if (this.spinner) {
      const text = this.spinner.text;
      this.spinner.stop();
      process.stderr.write(`${line}\n`);
      this.spinner = ora({ text, stream: process.stderr }).start();
    } else {
      process.stderr.write(`${line}\n`);
    }
  }

  /** Completes the run. */
  finish(message: string): void {
    this.settle();
    this.end("succeeded");
    const seconds = ((Date.now() - this.startedAt) / 1000).toFixed(1);
    process.stderr.write(
      `\n${chalk.green("✓")} ${chalk.bold(message)} ${chalk.dim(`(${seconds}s)`)}\n`,
    );
  }

  /** Fails the run, attributing the failure to the step that actually failed; `detail` is the cause. */
  fail(message: string, detail?: string): void {
    this.end("failed", detail ?? message);
    const step = this.steps[this.index];
    const where = step ? ` during ${step.label}` : "";

    if (this.spinner) {
      this.spinner.fail(this.spinner.text);
      this.spinner = null;
    }

    process.stderr.write(`\n${chalk.red("✗")} ${chalk.bold(message)}${chalk.dim(where)}\n`);
  }
}
