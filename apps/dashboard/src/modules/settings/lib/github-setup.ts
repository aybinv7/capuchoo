import type { GithubWorkflowSecret } from "@capuchoo/core";
import type { GithubSetup } from "@/shared/types/ci";

export type StepState = "done" | "todo" | "attention" | "waiting" | "optional";

export type WorkflowState =
  | { kind: "missing" }
  | { kind: "pull-request"; number: number; url: string }
  | { kind: "foreign"; path: string; url: string | null }
  | { kind: "outdated"; version: string | null; expected: string; url: string | null }
  | { kind: "ready"; version: string | null; url: string | null };

/** Where the workflow file stands: absent, proposed, someone else's, stale, or in place. */
export function workflowState(setup: GithubSetup): WorkflowState {
  const { workflow, pull_request: pr } = setup;
  if (!workflow.exists) {
    return pr?.state === "open"
      ? { kind: "pull-request", number: pr.number, url: pr.html_url }
      : { kind: "missing" };
  }
  if (!workflow.generated) return { kind: "foreign", path: workflow.path, url: workflow.html_url };
  const expected = workflow.expected_version ?? null;
  if (expected && workflow.version !== expected)
    return { kind: "outdated", version: workflow.version, expected, url: workflow.html_url };
  return { kind: "ready", version: workflow.version, url: workflow.html_url };
}

export const ANDROID_SECRETS = [
  "ANDROID_KEYSTORE_BASE64",
  "ANDROID_KEYSTORE_PASSWORD",
  "ANDROID_KEY_ALIAS",
  "ANDROID_KEY_PASSWORD",
] as const satisfies readonly GithubWorkflowSecret[];

const present = (setup: GithubSetup, name: GithubWorkflowSecret) =>
  setup.secrets.some((secret) => secret.name === name && secret.present);

export type VariableState =
  | { kind: "missing"; expected: string }
  | { kind: "wrong"; value: string; expected: string }
  | { kind: "set"; value: string };

export function variableState(setup: GithubSetup): VariableState {
  const { value, expected } = setup.variable;
  if (!value) return { kind: "missing", expected };
  if (value.replace(/\/+$/, "") !== expected.replace(/\/+$/, ""))
    return { kind: "wrong", value, expected };
  return { kind: "set", value };
}

export interface SetupProgress {
  workflow: StepState;
  apiKey: StepState;
  endpoint: StepState;
  android: StepState;
  /** The required steps that are done, out of the required steps. */
  done: number;
  total: number;
}

/** Each checklist step's state, and how many of the required ones are finished. */
export function setupProgress(setup: GithubSetup): SetupProgress {
  const workflow = workflowState(setup);
  const variable = variableState(setup);
  const androidCount = ANDROID_SECRETS.filter((name) => present(setup, name)).length;
  const steps = {
    workflow:
      workflow.kind === "ready"
        ? "done"
        : workflow.kind === "pull-request"
          ? "waiting"
          : workflow.kind === "missing"
            ? "todo"
            : "attention",
    apiKey: present(setup, "CAPUCHOO_API_KEY") ? "done" : "todo",
    endpoint: variable.kind === "set" ? "done" : variable.kind === "wrong" ? "attention" : "todo",
    android:
      androidCount === ANDROID_SECRETS.length
        ? "done"
        : androidCount === 0
          ? "optional"
          : "attention",
  } satisfies Record<string, StepState>;
  const required = [steps.workflow, steps.apiKey, steps.endpoint];
  return {
    ...steps,
    done: required.filter((state) => state === "done").length,
    total: required.length,
  };
}

/** The secrets the setup lists that no step manages on its own (e.g. the bundle signing key). */
export function otherSecrets(setup: GithubSetup) {
  const managed = new Set<string>(["CAPUCHOO_API_KEY", ...ANDROID_SECRETS]);
  return setup.secrets.filter((secret) => !managed.has(secret.name));
}
