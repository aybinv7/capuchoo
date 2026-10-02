import type { JobStatus, PipelinePlan } from "@capuchoo/core";
import { DAY, HOUR, MINUTE } from "./dice";
import type { FleetGroup } from "./fleet";
import type { AppCatalog } from "./releases";
import type { JobSpec, RunSpec } from "./runs";

const PROJECT = "https://gitlab.northwind.example/mobile/delivery";
const CLIENTS = ["contoso", "fabrikam"] as const;

export const DELIVERY: AppCatalog = {
  appId: "com.northwind.delivery",
  name: "Northwind Delivery",
  createdDays: 80,
  prodRole: "developer",
  permissions: [
    ["omar", "developer"],
    ["lea", "tester"],
  ],
  natives: [
    {
      key: "prod-300",
      version: "3.0.0",
      code: 300,
      flavour: "prod",
      days: 45,
      notes: "Camera-based proof of delivery and NFC tags.",
    },
  ],
  bundles: [
    { version: "3.2.0", flavour: "prod", days: 30, notes: "Turn-by-turn handoff to the maps app." },
    {
      version: "3.2.1",
      flavour: "prod",
      days: 18,
      notes: "Fixes duplicate stops after a route change.",
    },
    {
      version: "3.3.0",
      flavour: "prod",
      days: 4,
      notes: "Cash-on-delivery reconciliation at end of shift.",
    },
    {
      version: "3.4.0-rc.1",
      flavour: "staging",
      days: 1.2,
      notes: "Live tracking link for customers.",
    },
    {
      version: "3.4.0-dev.2",
      flavour: "dev",
      days: 2.5,
      notes: "Customer tracking link, first cut.",
    },
    {
      version: "3.4.0-dev.3",
      flavour: "dev",
      days: 0.8,
      notes: "Customer tracking link, ETA updates.",
    },
  ],
  channels: [
    { name: "dev", environment: "dev", bundle: "3.4.0-dev.3", native: null, selfSet: true },
    { name: "staging", environment: "staging", bundle: "3.4.0-rc.1", native: "prod-300" },
    { name: "prod", environment: "prod", bundle: "3.3.0", native: "prod-300" },
    {
      name: "prod-contoso",
      environment: "prod",
      bundle: "3.3.0",
      native: "prod-300",
      base: "prod",
    },
    {
      name: "prod-fabrikam",
      environment: "prod",
      bundle: "3.2.1",
      native: "prod-300",
      base: "prod",
    },
  ],
  moves: [
    { channel: "prod", from: "3.2.0", to: "3.2.1", days: 17.8, actor: "omar" },
    { channel: "prod-contoso", from: "3.2.0", to: "3.2.1", days: 17, actor: "omar" },
    { channel: "prod-fabrikam", from: "3.2.0", to: "3.2.1", days: 16, actor: "omar" },
    { channel: "prod", from: "3.2.1", to: "3.3.0", days: 3.9, actor: "omar" },
    { channel: "prod-contoso", from: "3.2.1", to: "3.3.0", days: 2.7, actor: "omar" },
    { channel: "dev", from: "3.4.0-dev.2", to: "3.4.0-dev.3", days: 0.8, actor: "omar" },
  ],
  pauses: [],
  config: [
    {
      environment: "all",
      channel: null,
      key: "tracking.share_link",
      value: "true",
      type: "boolean",
    },
  ],
  uploader: () => "omar",
};

export const DELIVERY_FLEET: FleetGroup[] = [
  { channel: "prod-contoso", count: 28, lag: 0.1, prefix: "DRV-C" },
  { channel: "prod-fabrikam", count: 19, lag: 0.05, prefix: "DRV-F" },
  { channel: "prod", count: 8, lag: 0.12, prefix: "DRV" },
  { channel: "staging", count: 3, lag: 0, prefix: "QA" },
];

const PLAN: PipelinePlan = {
  provider: "gitlab",
  source: ".gitlab-ci.yml",
  stages: ["check", "publish", "deliver"],
  jobs: [
    { key: "check", name: "check", needs: [], stage: "check", gated: false, condition: null },
    {
      key: "publish:ota",
      name: "publish:ota",
      needs: [],
      stage: "publish",
      gated: false,
      condition: null,
    },
    {
      key: "publish:native",
      name: "publish:native",
      needs: [],
      stage: "publish",
      gated: true,
      condition: null,
    },
    ...CLIENTS.map((client) => ({
      key: `deliver:${client}`,
      name: `deliver:${client}`,
      needs: [],
      stage: "deliver",
      gated: true,
      condition: null,
    })),
  ],
};

function trace(command: string, output: string[], failure?: string): string[] {
  const lines = [
    "\u001b[0KRunning with gitlab-runner 18.4.0 (a1b2c3d4)",
    '\u001b[0Ksection_start:1790900000:prepare_executor\r\u001b[0K\u001b[0K\u001b[36;1mPreparing the "docker" executor\u001b[0;m',
    "Using Docker executor with image node:22-bookworm ...",
    "\u001b[0Ksection_end:1790900000:prepare_executor\r\u001b[0K",
    "\u001b[0Ksection_start:1790900010:get_sources\r\u001b[0K\u001b[0K\u001b[36;1mGetting source from Git repository\u001b[0;m",
    "Fetching changes with git depth set to 20...",
    "\u001b[0Ksection_end:1790900010:get_sources\r\u001b[0K",
    '\u001b[0Ksection_start:1790900020:step_script\r\u001b[0K\u001b[0K\u001b[36;1mExecuting "step_script" stage of the job script\u001b[0;m',
    `$ ${command}`,
    ...output,
  ];
  if (failure)
    lines.push(
      `\u001b[31;1m${failure}\u001b[0;m`,
      "\u001b[31;1mERROR: Job failed: exit code 1\u001b[0;m",
    );
  else lines.push("\u001b[32;1mJob succeeded\u001b[0;m");
  return lines;
}

const job = (
  key: string,
  status: JobStatus,
  startAfter: number,
  seconds: number,
  lines?: string[],
): JobSpec => ({
  key,
  stage: PLAN.jobs.find((entry) => entry.key === key)?.stage ?? undefined,
  status,
  startAfter,
  seconds,
  steps: [],
  trace: lines,
});

let pipelineNumber = 18_420;
const pipeline = (
  fields: Omit<RunSpec, "source" | "runId" | "plan" | "workflow" | "runUrl" | "jobUrl">,
): RunSpec => {
  pipelineNumber += 11;
  return {
    source: "gitlab",
    runId: pipelineNumber,
    plan: PLAN,
    workflow: ".gitlab-ci.yml",
    runUrl: (id) => `${PROJECT}/-/pipelines/${id}`,
    jobUrl: (_id, jobId) => `${PROJECT}/-/jobs/${jobId}`,
    ...fields,
  };
};

const otaPublish = (
  version: string,
  channel: string,
  status: JobStatus = "succeeded",
  failure?: string,
) =>
  job(
    "publish:ota",
    status,
    70,
    status === "running" ? 0 : 58,
    status === "running"
      ? undefined
      : trace(
          `capuchoo deploy ota --channel "${channel}" -v "${version}" --yes --json`,
          [
            `[1/6] Resolving flavour and version`,
            `      - ${channel} flavour, v${version}`,
            "[6/6] Uploading",
          ],
          failure,
        ),
  );

const check = (
  version: string,
  channel: string,
  status: JobStatus = "succeeded",
  failure?: string,
) =>
  job(
    "check",
    status,
    0,
    64,
    trace(
      `capuchoo deploy ota --channel "${channel}" -v "${version}" --dry-run --yes --json`,
      ["[1/6] Resolving flavour and version", "Rehearsed, nothing uploaded"],
      failure,
    ),
  );

/** A GitLab-hosted app: stage order, manual jobs a person starts, and a pipeline still waiting on one. */
export function deliveryRuns(): RunSpec[] {
  return [
    pipeline({
      title: "Release 3.3.0",
      trigger: "push",
      ref: "v3.3.0",
      startedAgoMs: 4 * DAY,
      status: "running",
      actor: "omar",
      jobs: [
        check("3.3.0", "prod"),
        otaPublish("3.3.0", "prod"),
        job("publish:native", "waiting", 70, 0),
        job(
          "deliver:contoso",
          "succeeded",
          300,
          14,
          trace('npx --yes "@capuchoo/cli@0.16.1" channel point "prod-contoso" --version "3.3.0"', [
            "Pointed prod-contoso to OTA 3.3.0",
          ]),
        ),
        job("deliver:fabrikam", "waiting", 300, 0),
      ],
    }),
    pipeline({
      title: "Tracking link: ETA updates",
      trigger: "push",
      ref: "dev",
      startedAgoMs: 0.8 * DAY,
      status: "succeeded",
      actor: "omar",
      jobs: [
        check("3.4.0-dev.3", "dev"),
        otaPublish("3.4.0-dev.3", "dev"),
        job("publish:native", "skipped", 70, 0),
        job("deliver:contoso", "skipped", 300, 0),
        job("deliver:fabrikam", "skipped", 300, 0),
      ],
    }),
    pipeline({
      title: "Tracking link: share sheet",
      trigger: "merge_request_event",
      ref: "feature/tracking-share",
      startedAgoMs: 5 * HOUR,
      status: "failed",
      actor: "omar",
      error: "check failed",
      jobs: [
        check(
          "3.4.0-rc.2",
          "staging",
          "failed",
          "✗ Deploy failed during Building web assets: src/tracking/share.ts(12,3): error TS2554: Expected 1 arguments, but got 2.",
        ),
        job("publish:ota", "skipped", 70, 0),
        job("publish:native", "skipped", 70, 0),
        job("deliver:contoso", "skipped", 300, 0),
        job("deliver:fabrikam", "skipped", 300, 0),
      ],
    }),
    pipeline({
      title: "Release candidate 3.4.0-rc.1",
      trigger: "push",
      ref: "staging",
      startedAgoMs: 1.2 * DAY + 20 * MINUTE,
      status: "succeeded",
      actor: "omar",
      jobs: [
        check("3.4.0-rc.1", "staging"),
        otaPublish("3.4.0-rc.1", "staging"),
        job("publish:native", "skipped", 70, 0),
        job("deliver:contoso", "skipped", 300, 0),
        job("deliver:fabrikam", "skipped", 300, 0),
      ],
    }),
    pipeline({
      title: "Release 3.2.1",
      trigger: "push",
      ref: "v3.2.1",
      startedAgoMs: 17.8 * DAY,
      status: "succeeded",
      actor: "omar",
      jobs: [
        check("3.2.1", "prod"),
        otaPublish("3.2.1", "prod"),
        job("publish:native", "skipped", 70, 0),
        job(
          "deliver:contoso",
          "succeeded",
          300,
          12,
          trace('npx --yes "@capuchoo/cli@0.16.1" channel point "prod-contoso" --version "3.2.1"', [
            "Pointed prod-contoso to OTA 3.2.1",
          ]),
        ),
        job(
          "deliver:fabrikam",
          "succeeded",
          340,
          12,
          trace(
            'npx --yes "@capuchoo/cli@0.16.1" channel point "prod-fabrikam" --version "3.2.1"',
            ["Pointed prod-fabrikam to OTA 3.2.1"],
          ),
        ),
      ],
    }),
  ];
}
