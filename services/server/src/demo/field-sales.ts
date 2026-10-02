import { DAY, HOUR, MINUTE } from "./dice";
import type { FleetGroup } from "./fleet";
import {
  checkJob,
  deliverJob,
  githubPlan,
  planJob,
  publishNativeJob,
  publishOtaJob,
  skippedJob,
} from "./github-jobs";
import type { AppCatalog, BundleSpec, MoveSpec } from "./releases";
import type { RunSpec } from "./runs";

const REPOSITORY = "https://github.com/northwind/field-sales";

const DEV_NOTES = [
  "Delivery proof: capture screen",
  "Delivery proof: offline photo queue",
  "Delivery proof: signature pad",
  "Route map: cluster nearby visits",
  "Catalogue: barcode lookup on Zebra scanners",
  "Orders: split by warehouse",
  "Delivery proof with signature capture",
];

const devBundles: BundleSpec[] = DEV_NOTES.map((notes, index) => ({
  version: `1.10.0-dev.${index + 1}`,
  flavour: "dev" as const,
  days: 9 - index * 1.45,
  notes,
}));

const devMoves: MoveSpec[] = devBundles.slice(1).map((bundle, index) => ({
  channel: "dev",
  from: devBundles[index]!.version,
  to: bundle.version,
  days: bundle.days,
  actor: index % 2 === 0 ? "ines" : "omar",
}));

export const FIELD_SALES: AppCatalog = {
  appId: "com.northwind.fieldsales",
  name: "Northwind Field Sales",
  createdDays: 110,
  prodRole: "admin",
  permissions: [
    ["ines", "developer"],
    ["omar", "developer"],
    ["lea", "tester"],
  ],
  natives: [
    {
      key: "prod-170",
      version: "1.7.0",
      code: 170,
      flavour: "prod",
      days: 62,
      notes: "Barcode scanner on Zebra devices, Android 14 support.",
    },
    {
      key: "prod-190",
      version: "1.9.0",
      code: 190,
      flavour: "prod",
      days: 16,
      required: true,
      notes: "Bluetooth receipt printers and background sync. Required for 1.9 bundles.",
    },
    {
      key: "staging-190",
      version: "1.9.0",
      code: 190,
      flavour: "staging",
      days: 19,
      notes: "Release candidate of the 1.9 native layer.",
    },
  ],
  bundles: [
    { version: "1.7.0", flavour: "prod", days: 60, notes: "Visit planner and route optimisation." },
    {
      version: "1.7.1",
      flavour: "prod",
      days: 52,
      notes: "Fixes totals rounding on multi-currency orders.",
    },
    {
      version: "1.8.0",
      flavour: "prod",
      days: 41,
      notes: "Promotions engine and customer credit limits.",
    },
    {
      version: "1.8.1",
      flavour: "prod",
      days: 33,
      notes: "Faster catalogue search on large assortments.",
    },
    {
      version: "1.8.2",
      flavour: "prod",
      days: 24,
      notes: "Offline order queue retries with backoff.",
    },
    {
      version: "1.9.0",
      flavour: "prod",
      days: 14,
      minNative: 190,
      notes: "Receipt printing and background sync. Needs native 1.9.0.",
    },
    {
      version: "1.9.1",
      flavour: "prod",
      days: 3,
      minNative: 190,
      notes: "Stock reservation for key accounts.",
    },
    {
      version: "1.9.2-rc.1",
      flavour: "staging",
      days: 2,
      minNative: 190,
      notes: "Returns workflow, first candidate.",
    },
    {
      version: "1.9.2-rc.2",
      flavour: "staging",
      days: 0.92,
      minNative: 190,
      notes: "Returns workflow, fixes photo upload on slow networks.",
    },
    ...devBundles,
  ],
  channels: [
    { name: "dev", environment: "dev", bundle: "1.10.0-dev.7", native: null, selfSet: true },
    { name: "staging", environment: "staging", bundle: "1.9.2-rc.2", native: "staging-190" },
    { name: "prod", environment: "prod", bundle: "1.9.1", native: "prod-190" },
    {
      name: "prod-contoso",
      environment: "prod",
      bundle: "1.9.1",
      native: "prod-190",
      base: "prod",
    },
    {
      name: "prod-fabrikam",
      environment: "prod",
      bundle: "1.9.0",
      native: "prod-190",
      base: "prod",
    },
    {
      name: "prod-tailspin",
      environment: "prod",
      bundle: "1.8.2",
      native: "prod-170",
      base: "prod",
      paused: true,
    },
  ],
  moves: [
    { channel: "prod", from: "1.7.1", to: "1.8.0", days: 40, actor: "karim" },
    { channel: "prod-contoso", from: "1.7.1", to: "1.8.0", days: 39, actor: "karim" },
    { channel: "prod-fabrikam", from: "1.7.1", to: "1.8.0", days: 37, actor: "karim" },
    { channel: "prod", from: "1.8.0", to: "1.8.1", days: 32, actor: "karim" },
    { channel: "prod-tailspin", from: "1.8.0", to: "1.8.1", days: 30, actor: "karim" },
    { channel: "prod", from: "1.8.1", to: "1.8.2", days: 23, actor: "karim" },
    {
      channel: "prod",
      from: "1.8.2",
      to: "1.8.1",
      days: 22.6,
      actor: "owner",
      rollback: "Order sync stalls on Android 11 tablets after resume",
    },
    { channel: "prod", from: "1.8.1", to: "1.8.2", days: 21, actor: "karim" },
    { channel: "prod-tailspin", from: "1.8.1", to: "1.8.2", days: 20, actor: "karim" },
    { channel: "prod-contoso", from: "1.8.0", to: "1.8.2", days: 19, actor: "karim" },
    { channel: "prod", from: "1.8.2", to: "1.9.0", days: 13, actor: "owner" },
    { channel: "prod-contoso", from: "1.8.2", to: "1.9.0", days: 12, actor: "karim" },
    { channel: "prod-fabrikam", from: "1.8.0", to: "1.9.0", days: 6, actor: "karim" },
    { channel: "prod", from: "1.9.0", to: "1.9.1", days: 2.8, actor: "karim" },
    { channel: "prod-contoso", from: "1.9.0", to: "1.9.1", days: 1.9, actor: "karim" },
    { channel: "staging", from: "1.9.2-rc.1", to: "1.9.2-rc.2", days: 0.9, actor: "ines" },
    ...devMoves,
  ],
  pauses: [
    {
      channel: "prod-tailspin",
      days: 5,
      actor: "karim",
      reason: "Year-end stock count: Tailspin asked for no changes until it is over",
    },
  ],
  config: [
    {
      environment: "all",
      channel: null,
      key: "orders.offline_queue_limit",
      value: "500",
      type: "number",
    },
    {
      environment: "prod",
      channel: null,
      key: "catalogue.sync_interval_minutes",
      value: "30",
      type: "number",
    },
    {
      environment: "prod",
      channel: "prod-contoso",
      key: "features.stock_reservation",
      value: "true",
      type: "boolean",
    },
    {
      environment: "dev",
      channel: null,
      key: "features.delivery_proof",
      value: "true",
      type: "boolean",
    },
  ],
  uploader: (flavour) => (flavour === "prod" ? "karim" : "ines"),
};

export const FIELD_SALES_FLEET: FleetGroup[] = [
  { channel: "prod-contoso", count: 46, lag: 0.12, prefix: "CTS" },
  { channel: "prod-fabrikam", count: 38, lag: 0.07, prefix: "FBK" },
  { channel: "prod-tailspin", count: 24, lag: 0.05, prefix: "TSP" },
  { channel: "prod", count: 22, lag: 0.18, prefix: "NW" },
  { channel: "staging", count: 6, lag: 0, prefix: "QA" },
  { channel: "dev", count: 4, lag: 0, prefix: "DEV" },
];

const SIGNING =
  "The APK is signed with a different certificate than the previous release (expected 4F:A1:…:9C, got 9A:02:…:11)";
const TYPE_ERROR =
  "src/modules/returns/PhotoStep.vue(48,7): error TS2322: Type 'Blob | null' is not assignable to type 'Blob'.";
const VITE_ERROR =
  '[vite]: Rollup failed to resolve import "@/modules/returns/compress" from "src/modules/returns/PhotoStep.vue".';

let runNumber = 37_010_000;
const run = (
  fields: Omit<RunSpec, "source" | "runId" | "plan" | "workflow" | "runUrl" | "jobUrl">,
): RunSpec => {
  runNumber += 137;
  return {
    source: "github",
    runId: runNumber,
    plan: githubPlan(),
    workflow: ".github/workflows/capuchoo.yml",
    runUrl: (id) => `${REPOSITORY}/actions/runs/${id}`,
    jobUrl: (id, job) => `${REPOSITORY}/actions/runs/${id}/job/${job}`,
    ...fields,
  };
};

const pushToDev = (
  version: string,
  title: string,
  agoMs: number,
  actor: "ines" | "omar",
): RunSpec =>
  run({
    title,
    trigger: "push",
    ref: "dev",
    startedAgoMs: agoMs,
    status: "succeeded",
    actor,
    jobs: [
      planJob("succeeded", `**ota** to \`dev\` at \`auto\``),
      checkJob("succeeded", { version, channel: "dev" }),
      publishOtaJob("succeeded", { channel: "dev", version, bundle: version }),
      skippedJob("publish-native", 46),
      skippedJob("deliver"),
    ],
  });

const deliver = (
  client: string,
  version: string,
  agoMs: number,
  outcome: "succeeded" | "waiting",
): RunSpec =>
  run({
    title: `Deliver to prod-${client} @ ${version}`,
    trigger: "workflow_dispatch",
    ref: `v${version}`,
    startedAgoMs: agoMs,
    status: outcome === "waiting" ? "running" : "succeeded",
    actor: "karim",
    jobs: [
      planJob("succeeded", `**deliver** to \`prod\` at \`${version}\` for ${client}`),
      skippedJob("check"),
      skippedJob("publish-ota", 46),
      skippedJob("publish-native", 46),
      deliverJob(outcome, client, version),
    ],
  });

/** Six weeks of a team shipping through GitHub Actions, newest first. */
export function fieldSalesRuns(): RunSpec[] {
  return [
    run({
      title: "Delivery proof: resize photos before upload",
      trigger: "push",
      ref: "dev",
      startedAgoMs: 4 * MINUTE,
      status: "running",
      actor: "omar",
      jobs: [
        planJob("succeeded", "**ota** to `dev` at `auto`"),
        checkJob("succeeded", { version: "1.10.0-dev.8", channel: "dev" }),
        publishOtaJob(
          { runningAt: 6 },
          { channel: "dev", version: "1.10.0-dev.8", runningAt: "bundle" },
        ),
        skippedJob("publish-native", 46),
        skippedJob("deliver"),
      ],
    }),
    deliver("fabrikam", "1.9.1", 25 * MINUTE, "waiting"),
    run({
      title: "Returns: photo step on slow networks",
      trigger: "pull_request",
      ref: "feature/returns-photo",
      startedAgoMs: 2 * HOUR,
      status: "failed",
      actor: "omar",
      error: "check failed",
      jobs: [
        planJob("succeeded", "**check** to `staging` at `auto`"),
        checkJob(
          { failAt: 6 },
          {
            version: "1.9.2-rc.3",
            channel: "staging",
            failure: { step: "building web", message: TYPE_ERROR },
          },
        ),
        skippedJob("publish-ota", 46),
        skippedJob("publish-native", 46),
        skippedJob("deliver"),
      ],
    }),
    pushToDev("1.10.0-dev.7", "Delivery proof with signature capture", 7 * HOUR, "ines"),
    run({
      title: "Returns: retry photo uploads",
      trigger: "push",
      ref: "staging",
      startedAgoMs: 22 * HOUR,
      status: "succeeded",
      actor: "ines",
      jobs: [
        planJob("succeeded", "**ota** to `staging` at `auto`"),
        checkJob("succeeded", { version: "1.9.2-rc.2", channel: "staging" }),
        publishOtaJob("succeeded", {
          channel: "staging",
          version: "1.9.2-rc.2",
          bundle: "1.9.2-rc.2",
        }),
        skippedJob("publish-native", 46),
        skippedJob("deliver"),
      ],
    }),
    run({
      title: "Returns: compress photos",
      trigger: "push",
      ref: "staging",
      startedAgoMs: 23 * HOUR,
      status: "failed",
      actor: "ines",
      error: "check failed",
      jobs: [
        planJob("succeeded", "**ota** to `staging` at `auto`"),
        checkJob(
          { failAt: 6 },
          {
            version: "1.9.2-rc.2",
            channel: "staging",
            failure: { step: "building web", message: VITE_ERROR },
          },
        ),
        skippedJob("publish-ota", 46),
        skippedJob("publish-native", 46),
        skippedJob("deliver"),
      ],
    }),
    deliver("contoso", "1.9.1", 1.9 * DAY, "succeeded"),
    pushToDev("1.10.0-dev.6", "Orders: split by warehouse", 1.6 * DAY, "omar"),
    run({
      title: "Catalogue: barcode lookup (superseded)",
      trigger: "push",
      ref: "dev",
      startedAgoMs: 2.2 * DAY,
      status: "cancelled",
      actor: "omar",
      jobs: [
        planJob("succeeded", "**ota** to `dev` at `auto`"),
        checkJob({ cancelledAt: 5 }, { version: "1.10.0-dev.5", channel: "dev" }),
        skippedJob("publish-ota", 46),
        skippedJob("publish-native", 46),
        skippedJob("deliver"),
      ],
    }),
    run({
      title: "v1.9.1",
      trigger: "push",
      ref: "v1.9.1",
      startedAgoMs: 2.85 * DAY,
      status: "succeeded",
      actor: "karim",
      jobs: [
        planJob("succeeded", "**ota** to `prod` at `v1.9.1`"),
        checkJob("succeeded", { version: "1.9.1", channel: "prod" }),
        publishOtaJob("succeeded", { channel: "prod", version: "1.9.1", bundle: "1.9.1" }),
        skippedJob("publish-native", 46),
        skippedJob("deliver"),
      ],
    }),
    pushToDev("1.10.0-dev.5", "Catalogue: barcode lookup on Zebra scanners", 3.1 * DAY, "omar"),
    pushToDev("1.10.0-dev.4", "Route map: cluster nearby visits", 4.6 * DAY, "ines"),
    deliver("fabrikam", "1.9.0", 6 * DAY, "succeeded"),
    pushToDev("1.10.0-dev.3", "Delivery proof: signature pad", 6.1 * DAY, "ines"),
    deliver("contoso", "1.9.0", 12 * DAY, "succeeded"),
    run({
      title: "v1.9.0",
      trigger: "push",
      ref: "v1.9.0",
      startedAgoMs: 13.1 * DAY,
      status: "succeeded",
      actor: "owner",
      jobs: [
        planJob("succeeded", "**ota** to `prod` at `v1.9.0`"),
        checkJob("succeeded", { version: "1.9.0", channel: "prod" }),
        publishOtaJob("succeeded", { channel: "prod", version: "1.9.0", bundle: "1.9.0" }),
        skippedJob("publish-native", 46),
        skippedJob("deliver"),
      ],
    }),
    run({
      title: "Build native to prod @ 1.9.0",
      trigger: "workflow_dispatch",
      ref: "v1.9.0",
      startedAgoMs: 16 * DAY,
      status: "succeeded",
      actor: "karim",
      jobs: [
        planJob("succeeded", "**native** to `prod` at `1.9.0`"),
        checkJob("succeeded", { version: "1.9.0", channel: "prod" }),
        skippedJob("publish-ota", 46),
        publishNativeJob("succeeded", {
          channel: "prod",
          version: "1.9.0",
          versionCode: 190,
          native: "prod-190",
        }),
        skippedJob("deliver"),
      ],
    }),
    run({
      title: "Build native to prod @ 1.9.0",
      trigger: "workflow_dispatch",
      ref: "v1.9.0",
      startedAgoMs: 16 * DAY + 50 * MINUTE,
      status: "failed",
      actor: "karim",
      error: "publish-native failed",
      jobs: [
        planJob("succeeded", "**native** to `prod` at `1.9.0`"),
        checkJob("succeeded", { version: "1.9.0", channel: "prod" }),
        skippedJob("publish-ota", 46),
        publishNativeJob(
          { failAt: 9 },
          { channel: "prod", version: "1.9.0", versionCode: 190, failAt: "sign", error: SIGNING },
        ),
        skippedJob("deliver"),
      ],
    }),
  ];
}
