/** What the CLI can see about this machine and this directory. */
export interface OnboardingFacts {
  signedIn: boolean;
  /** Whether this looks like an application at all - a package.json. */
  inAppDirectory: boolean;
  /** Whether .capuchoo/project.json exists. */
  linked: boolean;
  updaterInstalled: boolean;
  /** null when not fetched, or when the backend could not be reached. */
  channels?: Array<{ name: string; servingBundle: boolean }> | null | undefined;
}

export interface NextStep {
  /** oclif command id. */
  command: string;
  label: string;
  why: string;
}

export type Stage =
  | "signed-out"
  | "not-an-app"
  | "unlinked"
  | "incomplete"
  | "no-channels"
  | "nothing-served"
  | "ready";

export interface OnboardingState {
  stage: Stage;
  /** The one thing to do now, or null when there is nothing to recommend. */
  next: NextStep | null;
}

/**
 * The single next action, so the first thing someone sees is a step rather than
 * a list to guess from.
 *
 * Order is by dependency: nothing can be done unsigned, nothing app-specific
 * without an app, nothing published without a channel.
 */
export function resolveOnboarding(facts: OnboardingFacts): OnboardingState {
  if (!facts.signedIn) {
    return {
      stage: "signed-out",
      next: {
        command: "auth:login",
        label: "Sign in",
        why: "Nothing can reach the backend until this machine has a credential.",
      },
    };
  }

  if (!facts.inAppDirectory) {
    return { stage: "not-an-app", next: null };
  }

  if (!facts.linked) {
    return {
      stage: "unlinked",
      next: {
        command: "init",
        label: "Set this app up",
        why: "Links it, installs what it needs, and wires the app up.",
      },
    };
  }

  if (!facts.updaterInstalled) {
    return {
      stage: "incomplete",
      next: {
        command: "init",
        label: "Finish setting up",
        why: "Linked, but the app cannot check for updates without @capuchoo/updater.",
      },
    };
  }

  // Channels are the only fact that needs the network, so an unknown value must
  // not be reported as a problem.
  if (facts.channels && facts.channels.length === 0) {
    return {
      stage: "no-channels",
      next: {
        command: "channel:create",
        label: "Create a channel",
        why: "There is nowhere to publish to yet.",
      },
    };
  }

  if (facts.channels && !facts.channels.some((channel) => channel.servingBundle)) {
    return {
      stage: "nothing-served",
      next: {
        command: "deploy:ota",
        label: "Publish the first bundle",
        why: "Every channel exists but none is serving anything, so devices get no update.",
      },
    };
  }

  return {
    stage: "ready",
    next: {
      command: "deploy:ota",
      label: "Publish an update",
      why: "Everything is wired up.",
    },
  };
}

/** Commands worth hiding in this state, by oclif id. */
export function hiddenCommands(facts: OnboardingFacts): Set<string> {
  if (!facts.signedIn) {
    // Signing in is the only useful action, and `config` is how someone points
    // at a different backend before trying.
    return new Set(["auth:logout", "auth:whoami"]);
  }

  return new Set(["auth:login"]);
}

/** A label that reads correctly for the current state, or null to keep the default. */
export function labelFor(command: string, facts: OnboardingFacts): string | null {
  // One command now, and re-running it is a no-op plus a check - so the label
  // says "re-check" rather than implying it will redo the setup.
  if (command === "init" && facts.linked && facts.updaterInstalled) return "init (re-check)";
  return null;
}

/** Whether only the next step should be offered, rather than the whole menu. */
export function isBlocked(state: OnboardingState): boolean {
  return state.stage === "signed-out";
}
