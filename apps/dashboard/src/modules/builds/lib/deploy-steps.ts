import type { BuildEvent, BuildStepStatus } from "@/shared/types/build";

/** The CLI's deploy steps in the order it runs them; others follow in order of appearance. */
export const DEPLOY_STEP_ORDER = [
  "resolve",
  "assets",
  "web",
  "native",
  "sync",
  "bundle",
  "sign",
  "upload",
] as const;

export interface DeployStep {
  step: string;
  status: BuildStepStatus;
  message: string | null;
  at: string;
}

/**
 * The latest status of each step a deploy reported, in pipeline order. `info` events carry a
 * message but no state, so they update the message without changing the status.
 */
export function deploySteps(events: readonly BuildEvent[]): DeployStep[] {
  const latest = new Map<string, DeployStep>();
  const firstSeen: string[] = [];
  for (const event of events) {
    const current = latest.get(event.step);
    if (!current) firstSeen.push(event.step);
    latest.set(event.step, {
      step: event.step,
      status: event.status === "info" ? (current?.status ?? "info") : event.status,
      message: event.message ?? current?.message ?? null,
      at: event.created_at,
    });
  }
  const rank = (step: string) => {
    const index = (DEPLOY_STEP_ORDER as readonly string[]).indexOf(step);
    return index === -1 ? DEPLOY_STEP_ORDER.length + firstSeen.indexOf(step) : index;
  };
  return [...latest.values()].sort((a, b) => rank(a.step) - rank(b.step));
}

/** The step to name beside the track: the failing one, else the latest still running. */
export function currentDeployStep(steps: readonly DeployStep[]): DeployStep | null {
  return (
    steps.find((step) => step.status === "failed") ??
    [...steps].reverse().find((step) => step.status === "running") ??
    steps[steps.length - 1] ??
    null
  );
}
