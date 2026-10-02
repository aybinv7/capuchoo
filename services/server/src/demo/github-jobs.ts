import {
  GITHUB_WORKFLOW_PATH,
  renderGithubWorkflow,
  type JobStatus,
  type PipelinePlan,
} from "@capuchoo/core";
import { parseGithubWorkflowPlan } from "../github/workflow-plan";
import { STEP_SCRIPTS, deployScript, uploadScript, type StepScript } from "./log-text";
import type { DeploySpec, JobSpec, StepSpec } from "./runs";

export const DEMO_CLIENTS = ["contoso", "fabrikam", "tailspin"] as const;

/** The graph of the very workflow Capuchoo generates, read back the way a live run's is. */
export function githubPlan(): PipelinePlan {
  const plan = parseGithubWorkflowPlan(
    renderGithubWorkflow({ cliVersion: "0.16.1", clients: [...DEMO_CLIENTS] }),
    GITHUB_WORKFLOW_PATH,
  );
  if (!plan) throw new Error("The generated workflow has no job graph");
  return plan;
}

export type Outcome =
  | "succeeded"
  | "skipped"
  | "waiting"
  | "queued"
  | "pending"
  | { failAt: number }
  | { runningAt: number }
  | { cancelledAt: number };

function apply(outcome: Outcome): Pick<JobSpec, "status" | "failAt" | "runningAt"> {
  if (typeof outcome === "string") return { status: outcome as JobStatus };
  if ("failAt" in outcome) return { status: "failed", failAt: outcome.failAt };
  if ("runningAt" in outcome) return { status: "running", runningAt: outcome.runningAt };
  return { status: "cancelled", failAt: outcome.cancelledAt };
}

const step = (
  number: number,
  name: string,
  seconds: number,
  script: StepScript,
  always = false,
): StepSpec => ({
  number,
  name,
  seconds,
  script,
  always,
});

const POST_STEPS = (start: number): StepSpec[] => [
  step(start, "Post Run actions/cache@v4", 2, STEP_SCRIPTS.POST, true),
  step(start + 1, "Post Run actions/setup-node@v5", 1, STEP_SCRIPTS.POST, true),
  step(start + 2, "Post Run actions/checkout@v5", 1, STEP_SCRIPTS.POST, true),
  step(start + 3, "Complete job", 1, STEP_SCRIPTS.COMPLETE, true),
];

const NODE_STEPS = (from: number): StepSpec[] => [
  step(from, "Run actions/checkout@v5", 1, STEP_SCRIPTS.CHECKOUT),
  step(from + 1, "Run actions/setup-node@v5", 3, STEP_SCRIPTS.SETUP_NODE),
  step(from + 2, "Run actions/cache@v4", 3, STEP_SCRIPTS.CACHE),
  step(from + 3, "Install", 9, STEP_SCRIPTS.INSTALL),
];

export function planJob(outcome: Outcome, summary: string): JobSpec {
  return {
    key: "plan",
    startAfter: 0,
    ...apply(outcome),
    steps: [
      step(1, "Set up job", 1, STEP_SCRIPTS.SETUP),
      step(2, "Run set -euo pipefail", 1, [
        "##[group]Run set -euo pipefail",
        "set -euo pipefail",
        "##[endgroup]",
        summary,
      ]),
      step(3, "Complete job", 1, STEP_SCRIPTS.COMPLETE, true),
    ],
  };
}

export function checkJob(
  outcome: Outcome,
  target: { version: string; channel: string; failure?: { step: string; message: string } },
): JobSpec {
  return {
    key: "check",
    startAfter: 8,
    ...apply(outcome),
    steps: [
      step(1, "Set up job", 1, STEP_SCRIPTS.SETUP),
      ...NODE_STEPS(2),
      step(
        6,
        "Rehearse the deploy",
        28,
        deployScript({
          command: `capuchoo deploy ota --channel "$CHANNEL" -v "$VERSION" --dry-run --yes --json > "$GITHUB_WORKSPACE/capuchoo-check.json"`,
          version: target.version,
          channel: target.channel,
          kind: "ota",
          dryRun: true,
          failure: target.failure ?? null,
        }),
      ),
      step(7, "Run actions/upload-artifact@v4", 1, uploadScript("capuchoo-check"), true),
      ...POST_STEPS(12),
    ],
  };
}

export function publishOtaJob(
  outcome: Outcome,
  deploy: Omit<DeploySpec, "inStep" | "kind">,
): JobSpec {
  return {
    key: "publish-ota",
    startAfter: 46,
    ...apply(outcome),
    deploy: { ...deploy, kind: "ota", inStep: 6 },
    steps: [
      step(1, "Set up job", 1, STEP_SCRIPTS.SETUP),
      ...NODE_STEPS(2),
      step(
        6,
        "Publish the OTA bundle",
        24,
        deployScript({
          command: `capuchoo deploy ota --channel "$CHANNEL" -v "$VERSION" --note "$NOTE" --yes --json > "$GITHUB_WORKSPACE/capuchoo-ota.json"`,
          version: deploy.version,
          channel: deploy.channel,
          kind: "ota",
          failure: deploy.failAt
            ? {
                step: deploy.failAt === "upload" ? "uploading" : deploy.failAt,
                message: deploy.error ?? "failed",
              }
            : null,
        }),
      ),
      step(7, "Run actions/upload-artifact@v4", 1, uploadScript("capuchoo-ota"), true),
      ...POST_STEPS(12),
    ],
  };
}

export function publishNativeJob(
  outcome: Outcome,
  deploy: Omit<DeploySpec, "inStep" | "kind">,
): JobSpec {
  return {
    key: "publish-native",
    startAfter: 46,
    ...apply(outcome),
    deploy: { ...deploy, kind: "native", inStep: 9 },
    steps: [
      step(1, "Set up job", 1, STEP_SCRIPTS.SETUP),
      step(2, "Run actions/setup-java@v5", 6, [
        "##[group]Run actions/setup-java@v5",
        "with:",
        "  distribution: temurin",
        "  java-version: 21",
        "##[endgroup]",
        "Java 21.0.8 was found in the cache",
      ]),
      step(3, "Run android-actions/setup-android@v3", 18, [
        "##[group]Run android-actions/setup-android@v3",
        "##[endgroup]",
        "Installing platform-tools, platforms;android-35, build-tools;35.0.0",
        "All SDK package licenses accepted.",
      ]),
      ...NODE_STEPS(4),
      step(8, "Restore the release keystore", 1, [
        "##[group]Run set -euo pipefail",
        "set -euo pipefail",
        "##[endgroup]",
      ]),
      step(
        9,
        "Build and publish the APK",
        236,
        deployScript({
          command: `capuchoo deploy native --channel "$CHANNEL" --type="$BUILD_TYPE" -v "$VERSION" --note "$NOTE" --yes --json`,
          version: deploy.version,
          channel: deploy.channel,
          kind: "native",
          failure: deploy.failAt
            ? {
                step:
                  deploy.failAt === "sign"
                    ? "signing"
                    : deploy.failAt === "bundle"
                      ? "compiling"
                      : deploy.failAt,
                message: deploy.error ?? "failed",
              }
            : null,
        }),
      ),
      step(
        10,
        "Remove the keystore",
        1,
        ['##[group]Run rm -f "$APP_DIR/android/release.keystore"', "##[endgroup]"],
        true,
      ),
      step(11, "Run actions/upload-artifact@v4", 1, uploadScript("capuchoo-native"), true),
      ...POST_STEPS(16),
    ],
  };
}

export function deliverJob(outcome: Outcome, client: string, version: string): JobSpec {
  const channel = `prod-${client}`;
  return {
    key: "deliver",
    startAfter: 8,
    ...apply(outcome),
    steps: [
      step(1, "Set up job", 1, STEP_SCRIPTS.SETUP),
      step(2, "Run actions/checkout@v5", 1, STEP_SCRIPTS.CHECKOUT),
      step(3, "Run actions/setup-node@v5", 2, STEP_SCRIPTS.SETUP_NODE),
      step(4, "Point the client channel at what prod serves", 6, [
        `##[group]Run npx --yes "@capuchoo/cli@$CAPUCHOO_CLI_VERSION" channel point "prod-$CLIENT" --version "\${VERSION#v}"`,
        "##[endgroup]",
        `Checking ${channel} against prod: ${version} has been served on prod`,
        `\u001b[32m✓ Pointed ${channel} to OTA ${version}\u001b[39m`,
      ]),
      step(8, "Post Run actions/setup-node@v5", 1, STEP_SCRIPTS.POST, true),
      step(9, "Post Run actions/checkout@v5", 1, STEP_SCRIPTS.POST, true),
      step(10, "Complete job", 1, STEP_SCRIPTS.COMPLETE, true),
    ],
  };
}

/** A job the plan has that this run never needed. */
export const skippedJob = (key: string, startAfter = 8): JobSpec => ({
  key,
  startAfter,
  status: "skipped",
  steps: [],
});
