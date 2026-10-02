import {
  isJobStatus,
  parsePipelinePlan,
  type Environment,
  type PipelineStep,
} from "@capuchoo/core";
import type { Build, BuildChild, BuildDetail, BuildEvent, BuildJob } from "../types/build";
import type { Channel } from "../types/release";

type Row = Record<string, unknown>;

const ENVIRONMENTS = new Set<Environment>(["dev", "staging", "prod"]);

function isRow(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const text = (value: unknown): string | null => (typeof value === "string" ? value : null);
const flag = (value: unknown, fallback = false): boolean =>
  typeof value === "boolean" ? value : fallback;
const time = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return null;
};

/**
 * The stream publishes channel rows as stored (`is_public`), while the REST API serializes them
 * (`public`). Both become the serialized shape; anything without an id and app is dropped.
 */
export function normalizeChannel(value: unknown): Channel | null {
  if (!isRow(value)) return null;
  const id = text(value.id);
  const appId = text(value.app_id);
  const name = text(value.name);
  const environment = value.environment as Environment;
  if (!id || !appId || !name || !ENVIRONMENTS.has(environment)) return null;
  return {
    id,
    app_id: appId,
    name,
    environment,
    kind: value.kind === "client" ? "client" : "release",
    base_channel_id: text(value.base_channel_id),
    public: flag(value.public ?? value.is_public),
    allow_device_self_set: flag(value.allow_device_self_set),
    allow_dev: flag(value.allow_dev),
    allow_emulator: flag(value.allow_emulator),
    ios_enabled: flag(value.ios_enabled, true),
    android_enabled: flag(value.android_enabled, true),
    paused: flag(value.paused),
    allow_downgrade: flag(value.allow_downgrade),
    current_bundle_id: text(value.current_bundle_id),
    current_native_id: text(value.current_native_id),
    created_at: time(value.created_at),
    updated_at: time(value.updated_at),
  };
}

const BUILD_STATUSES = new Set<Build["status"]>([
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);
const count = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/**
 * A build row from the stream or the REST API. Detail-only fields (`events`, `jobs`, `plan`,
 * `children`) are stripped so a row never overwrites what a detail query holds; fields a server
 * without CI support omits become null.
 */
export function normalizeBuild(value: unknown): Build | null {
  if (!isRow(value) || !text(value.id) || !text(value.app_id)) return null;
  const { events: _events, jobs: _jobs, plan: _plan, children: _children, ...row } = value;
  return {
    ...(row as unknown as Build),
    status: BUILD_STATUSES.has(value.status as Build["status"])
      ? (value.status as Build["status"])
      : "queued",
    created_at: time(value.created_at) ?? new Date(0).toISOString(),
    started_at: time(value.started_at),
    finished_at: time(value.finished_at),
    parent_id: text(value.parent_id),
    job_key: text(value.job_key),
    run_attempt: count(value.run_attempt),
    workflow: text(value.workflow),
    title: text(value.title),
    trigger: text(value.trigger),
  };
}

function normalizeStep(value: unknown, index: number): PipelineStep | null {
  if (!isRow(value)) return null;
  const name = text(value.name);
  if (!name) return null;
  return {
    number: count(value.number) ?? index + 1,
    name,
    status: isJobStatus(value.status) ? value.status : "pending",
    started_at: time(value.started_at),
    completed_at: time(value.completed_at),
  };
}

/** A `build_job` stream message or one row of `BuildDetail.jobs`; null when it names no job. */
export function normalizeBuildJob(value: unknown): BuildJob | null {
  if (!isRow(value)) return null;
  const id = text(value.id);
  const buildId = text(value.build_id);
  if (!id || !buildId) return null;
  const steps = Array.isArray(value.steps)
    ? value.steps
        .map(normalizeStep)
        .filter((step): step is PipelineStep => step !== null)
        .sort((a, b) => a.number - b.number)
    : [];
  return {
    id,
    build_id: buildId,
    external_id: text(value.external_id) ?? id,
    plan_key: text(value.plan_key),
    name: text(value.name) ?? text(value.plan_key) ?? "job",
    stage: text(value.stage),
    status: isJobStatus(value.status) ? value.status : "pending",
    attempt: count(value.attempt) ?? 1,
    url: text(value.url),
    runner: text(value.runner),
    steps,
    started_at: time(value.started_at),
    finished_at: time(value.finished_at),
    updated_at: time(value.updated_at) ?? time(value.finished_at) ?? new Date(0).toISOString(),
  };
}

const list = (entry: unknown): unknown[] => (Array.isArray(entry) ? entry : []);

const eventsOf = (value: Row): BuildEvent[] =>
  list(value.events)
    .map(normalizeBuildEvent)
    .filter((event): event is BuildEvent => event !== null)
    .sort((a, b) => Number(a.id) - Number(b.id));

/** A deploy under a run, with its steps; a server that sends none gives an empty list. */
export function normalizeBuildChild(value: unknown): BuildChild | null {
  const build = normalizeBuild(value);
  if (!build || !isRow(value)) return null;
  return { ...build, events: eventsOf(value) };
}

/** `GET /api/builds/:id` and `POST /api/builds/:id/sync`, total over a server without CI fields. */
export function normalizeBuildDetail(value: unknown): BuildDetail | null {
  const build = normalizeBuild(value);
  if (!build || !isRow(value)) return null;
  return {
    ...build,
    events: eventsOf(value),
    jobs: list(value.jobs)
      .map(normalizeBuildJob)
      .filter((job): job is BuildJob => job !== null),
    plan: parsePipelinePlan(value.plan),
    children: list(value.children)
      .map(normalizeBuildChild)
      .filter((child): child is BuildChild => child !== null),
  };
}

export function normalizeBuildEvent(value: unknown): BuildEvent | null {
  if (!isRow(value)) return null;
  const buildId = text(value.build_id);
  const step = text(value.step);
  if (!buildId || !step || (typeof value.id !== "string" && typeof value.id !== "number"))
    return null;
  return {
    id: String(value.id),
    build_id: buildId,
    step,
    status: (text(value.status) ?? "info") as BuildEvent["status"],
    message: text(value.message),
    created_at: time(value.created_at) ?? new Date(0).toISOString(),
  };
}
