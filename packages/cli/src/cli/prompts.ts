import * as clack from "@clack/prompts";
import { stdin, stdout } from "node:process";

/**
 * Interactive prompts, with three rules that decide how this CLI feels.
 *
 * 1. **One choice is not a question.** If there is exactly one thing the user
 *    could pick, pick it and say so. Asking is theatre.
 * 2. **A non-interactive shell is told which flag to use**, not left to guess
 *    or - worse - hung on a prompt nobody can answer. Every prompt names its
 *    escape hatch, because the same commands run in CI.
 * 3. **Cancelling changes nothing**, and says so. Ctrl-C mid-wizard should not
 *    leave half a config behind.
 *
 * Long lists switch from a menu to a filter: past about eight entries, scrolling
 * is worse than typing.
 */

const AUTOCOMPLETE_THRESHOLD = 8;

export class PromptCancelled extends Error {
  constructor() {
    super("Cancelled. Nothing changed.");
    this.name = "PromptCancelled";
  }
}

/** Raised when a prompt is unanswerable, naming the flag that replaces it. */
export class NonInteractive extends Error {
  constructor(question: string, flag: string) {
    super(`${question} cannot be asked in a non-interactive shell. Pass ${flag}.`);
    this.name = "NonInteractive";
  }
}

export interface Choice<T> {
  value: T;
  label: string;
  hint?: string | undefined;
}

export function isInteractive(): boolean {
  return Boolean(stdin.isTTY && stdout.isTTY);
}

function settle<T>(answer: T | symbol): T {
  if (clack.isCancel(answer)) throw new PromptCancelled();
  return answer as T;
}

export function intro(title: string): void {
  clack.intro(title);
}

export function outro(message: string): void {
  clack.outro(message);
}

export const log = {
  info: (message: string) => clack.log.info(message),
  step: (message: string) => clack.log.step(message),
  warn: (message: string) => clack.log.warn(message),
  error: (message: string) => clack.log.error(message),
  success: (message: string) => clack.log.success(message),
  message: (message: string) => clack.log.message(message),
};

/** A boxed aside - for the "here is what happens next" moments. */
export function note(body: string, title?: string): void {
  clack.note(body, title);
}

export function spinner(): { start: (m: string) => void; stop: (m?: string) => void } {
  const instance = clack.spinner();
  return {
    start: (message: string) => instance.start(message),
    stop: (message?: string) => instance.stop(message),
  };
}

/**
 * How long a call may take before silence starts to look like a hang.
 *
 * Under this, a spinner would appear and vanish within a frame, which reads as a
 * glitch rather than progress.
 */
const LOOKS_STUCK_AFTER_MS = 400;

/**
 * Runs work, and shows a spinner only once it has been slow enough to worry about.
 *
 * The backend is on a host that sleeps when idle, so the first request of a
 * session can take fifteen seconds to come back. Every command opened with an
 * unannounced `whoami()`, so `capuchoo doctor` and `capuchoo deploy native` sat
 * with a blank terminal for that whole time and looked broken - the user
 * reported the CLI itself as laggy, which it is not: `--version` returns in
 * 190ms.
 *
 * Deliberately delayed rather than always-on. A warm backend answers in well
 * under the threshold and stays silent, so the spinner only ever appears when
 * there is genuinely something to wait for.
 */
export async function whileWaiting<T>(message: string, work: Promise<T>): Promise<T> {
  if (!isInteractive()) return work;

  // Held on an object rather than in a plain `let`: control-flow analysis cannot
  // see an assignment made inside a timer callback, so a `let` stays narrowed to
  // its initialiser and the guard below becomes a type error.
  const shown: { spinner?: ReturnType<typeof spinner> } = {};

  const timer = setTimeout(() => {
    shown.spinner = spinner();
    shown.spinner.start(message);
  }, LOOKS_STUCK_AFTER_MS);

  try {
    return await work;
  } finally {
    clearTimeout(timer);
    // stop() on a spinner that never started throws, hence the guard rather
    // than an unconditional call.
    shown.spinner?.stop();
  }
}

export async function selectOne<T>(
  question: string,
  choices: Choice<T>[],
  flag: string,
): Promise<T> {
  if (choices.length === 0) throw new Error(`Nothing to choose from for: ${question}`);
  if (choices.length === 1) {
    const only = choices[0]!;
    log.info(`${question}: ${only.label}`);
    return only.value;
  }
  if (!isInteractive()) throw new NonInteractive(question, flag);

  // clack's `Option` is an internal conditional type, not exported, and this
  // workspace runs with exactOptionalPropertyTypes - so an inferred `hint?:
  // string | undefined` is not assignable to its `hint?: string`. The cast goes
  // through clack's own parameter type rather than a hand-written shape, so it
  // still breaks if their option shape changes.
  const options = choices.map((choice) => {
    const option: { value: T; label: string; hint?: string } = {
      value: choice.value,
      label: choice.label,
    };
    if (choice.hint) option.hint = choice.hint;
    return option;
  }) as Parameters<typeof clack.select<T>>[0]["options"];

  if (choices.length > AUTOCOMPLETE_THRESHOLD) {
    // Submitting an autocomplete with nothing highlighted - Enter on a filter
    // that matches nothing, which is easy to do - resolves to `undefined`, not
    // to a cancel. Returned as-is it crashed the caller on the next property
    // read ("Cannot read properties of undefined"), which reads like a bug in
    // whatever you were trying to run. Ask again instead; Ctrl+C still leaves.
    for (;;) {
      const answer = settle(
        await clack.autocomplete({
          message: question,
          options: options as Parameters<typeof clack.autocomplete<T>>[0]["options"],
          maxItems: AUTOCOMPLETE_THRESHOLD,
          placeholder: "Type to filter...",
        }),
      );

      if (answer !== undefined && answer !== null) return answer;

      log.warn("Nothing selected. Pick one with the arrow keys, or press Ctrl+C to leave.");
    }
  }

  return settle(await clack.select({ message: question, options }));
}

export async function confirm(
  question: string,
  options: { default?: boolean; flag?: string } = {},
): Promise<boolean> {
  if (!isInteractive()) {
    if (options.default === undefined) {
      throw new NonInteractive(question, options.flag ?? "--yes");
    }
    return options.default;
  }

  return settle(await clack.confirm({ message: question, initialValue: options.default ?? false }));
}

export async function askText(
  question: string,
  options: {
    placeholder?: string;
    initial?: string;
    flag: string;
    validate?: (v: string) => string | undefined;
    optional?: boolean;
  },
): Promise<string> {
  if (!isInteractive()) {
    if (options.initial !== undefined) return options.initial;
    if (options.optional) return "";
    throw new NonInteractive(question, options.flag);
  }

  const answer = settle(
    await clack.text({
      message: question,
      ...(options.placeholder ? { placeholder: options.placeholder } : {}),
      ...(options.initial ? { initialValue: options.initial } : {}),
      validate: (value) => {
        if (!options.optional && !value?.trim()) return "Required.";
        return options.validate?.(value ?? "");
      },
    }),
  );

  return answer.trim();
}

export async function askSecret(question: string): Promise<string> {
  if (!isInteractive()) {
    throw new Error(
      `${question} cannot be asked in a non-interactive shell. ` +
        "Set CAPUCHOO_API_KEY, or pass --api-key.",
    );
  }

  return settle(
    await clack.password({
      message: question,
      validate: (value) => (value?.trim() ? undefined : "Required."),
    }),
  );
}
