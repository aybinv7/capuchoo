/**
 * The one onboarding, as a list of steps that each know whether they are done.
 *
 * `login`, `setup` and `init` were three commands, and between them they left
 * three edits for the operator to apply by hand. Nobody applied them: every
 * first run - two of mine and one of the user's - got as far as `deploy` and was
 * refused for a missing VITE_UPDATE_API_URL. Merging the commands alone would
 * not have fixed that; the manual steps had to become real steps.
 *
 * Capgo reached the same shape. `@capgo/cli@8.42.3` ships
 * `dist/src/init/onboarding-steps.d.ts` with twelve of them - add_app,
 * add_channel, add_updater, add_code, ..., upload_bundle, test_update,
 * completion - so their `init` installs, writes code, builds, and proves an
 * update landed before it reports success.
 *
 * Pure here so re-running is provably a no-op: every step reads a fact and says
 * "satisfied", and the CLI only performs what is left. That is what makes one
 * command safe to run whenever you are unsure, which is the actual cure for
 * having to know which of three commands you needed.
 */

export const INIT_STEPS = [
  "credentials",
  "link",
  "identifiers",
  "channels",
  "packages",
  "env",
  "code",
  "verify",
  "publish",
  "confirm",
] as const;

export type InitStepId = (typeof INIT_STEPS)[number];

/** What the CLI could see before doing anything. */
export interface InitFacts {
  signedIn: boolean;
  /** .capuchoo/project.json exists and parses. */
  linked: boolean;
  /** The app's bundle identifier is registered server-side. */
  identifierRegistered: boolean;
  channelCount: number;
  /** @capuchoo/updater and the Capgo plugin are both app dependencies. */
  packagesInstalled: boolean;
  /** Every flavour env file sets both update variables. */
  flavoursMissingEnv: number;
  /** notifyAppReady() is called and the plugin block uses the helper. */
  codeWired: boolean;
  /** Some channel is serving a bundle. */
  servingBundle: boolean;
  /** A device has reported running the served bundle. */
  deviceConfirmed: boolean;
}

export type StepStatus = "satisfied" | "todo" | "unknown";

export interface PlannedStep {
  id: InitStepId;
  status: StepStatus;
  /** One line: what this step is for, or why it is already done. */
  why: string;
}

export interface PlanOptions {
  /**
   * Whether to publish and then wait for a device.
   *
   * Off by default. It builds the app and uploads a release, which is not
   * something a command should do because it was run twice.
   */
  prove?: boolean;
}

/**
 * The steps, in dependency order, each with what is left to do.
 *
 * Nothing here is "blocked": the steps run in one pass and each one's
 * prerequisite is the step before it. A caller that stops early stops on a
 * failure, not on a plan that knew it could not finish.
 */
export function planInit(facts: InitFacts, options: PlanOptions = {}): PlannedStep[] {
  const steps: PlannedStep[] = [
    {
      id: "credentials",
      status: facts.signedIn ? "satisfied" : "todo",
      why: facts.signedIn ? "signed in" : "nothing can reach the backend without a credential",
    },
    {
      id: "link",
      status: facts.linked ? "satisfied" : "todo",
      why: facts.linked ? "linked" : "this directory has no app",
    },
    {
      id: "identifiers",
      // Unknown rather than todo when unlinked: the answer needs the app, and
      // reporting "todo" for something unknowable reads as a problem.
      status: !facts.linked ? "unknown" : facts.identifierRegistered ? "satisfied" : "todo",
      why: facts.identifierRegistered
        ? "the bundle identifier is registered"
        : "a device reports only the identifier compiled into it",
    },
    {
      id: "channels",
      status: !facts.linked ? "unknown" : facts.channelCount > 0 ? "satisfied" : "todo",
      why:
        facts.channelCount > 0
          ? `${facts.channelCount} channel${facts.channelCount === 1 ? "" : "s"}`
          : "there is nowhere to publish to",
    },
    {
      id: "packages",
      status: facts.packagesInstalled ? "satisfied" : "todo",
      why: facts.packagesInstalled
        ? "the runtime and the plugin are installed"
        : "the app cannot check for updates without them",
    },
    {
      id: "env",
      status: facts.flavoursMissingEnv === 0 ? "satisfied" : "todo",
      why:
        facts.flavoursMissingEnv === 0
          ? "every flavour has an update URL and a channel"
          : `${facts.flavoursMissingEnv} flavour${
              facts.flavoursMissingEnv === 1 ? "" : "s"
            } would ship with updates disabled`,
    },
    {
      id: "code",
      status: facts.codeWired ? "satisfied" : "todo",
      why: facts.codeWired
        ? "notifyAppReady() is called and the plugin is configured"
        : "without notifyAppReady() every update installs and then reverts",
    },
    {
      id: "verify",
      // Always run: it is the step that says whether the rest worked, and a
      // cached "satisfied" would be a claim rather than a check.
      status: "todo",
      why: "confirm the wiring against the backend",
    },
  ];

  if (!options.prove) return steps;

  steps.push(
    {
      id: "publish",
      status: facts.servingBundle ? "satisfied" : "todo",
      why: facts.servingBundle
        ? "a channel is serving a bundle"
        : "build and publish the first one",
    },
    {
      id: "confirm",
      status: facts.deviceConfirmed ? "satisfied" : "todo",
      why: facts.deviceConfirmed
        ? "a device has reported the served bundle"
        : "wait for a device to fetch it, so success is observed and not assumed",
    },
  );

  return steps;
}

/** The steps that will actually do something. */
export function pendingSteps(plan: PlannedStep[]): PlannedStep[] {
  return plan.filter((step) => step.status === "todo");
}

/** Whether a re-run has anything to do beyond checking. */
export function isComplete(plan: PlannedStep[]): boolean {
  return pendingSteps(plan).every((step) => step.id === "verify");
}

/**
 * Applies --only and --skip.
 *
 * `--only` keeps `verify` unless it was excluded by name, because a step that
 * changed something and then reported nothing about it is worse than slow.
 */
export function selectSteps(
  plan: PlannedStep[],
  filters: { only?: string[] | undefined; skip?: string[] | undefined },
): PlannedStep[] {
  const only = filters.only?.filter((id) => id.length > 0);
  const skip = new Set(filters.skip ?? []);

  return plan.filter((step) => {
    if (skip.has(step.id)) return false;
    if (!only || only.length === 0) return true;

    return only.includes(step.id) || step.id === "verify";
  });
}

export function isInitStep(value: string): value is InitStepId {
  return (INIT_STEPS as readonly string[]).includes(value);
}
