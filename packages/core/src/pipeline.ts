/**
 * The shape of a CI run as every part of Capuchoo sees it: the server stores it, the CLI reports
 * into it, the dashboard draws it. Provider payloads (GitHub, GitLab) are translated into these
 * types at the edge and never leak further in.
 */

export const BUILD_STATUSES = ["queued", "running", "succeeded", "failed", "cancelled"] as const;
export type BuildStatus = (typeof BUILD_STATUSES)[number];

export const BUILD_SOURCES = ["cli", "gitlab", "github", "other"] as const;
export type BuildSource = (typeof BUILD_SOURCES)[number];

export const CI_PROVIDERS = ["github", "gitlab"] as const;
export type CiProvider = (typeof CI_PROVIDERS)[number];

/**
 * `pending` is a job the plan declares that the provider has not created yet; `waiting` is a job
 * held for a person - a GitHub environment approval or a GitLab manual job.
 */
export const JOB_STATUSES = [
  "pending",
  "queued",
  "waiting",
  "running",
  "succeeded",
  "failed",
  "cancelled",
  "skipped",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

const TERMINAL_BUILD = new Set<BuildStatus>(["succeeded", "failed", "cancelled"]);
const TERMINAL_JOB = new Set<JobStatus>(["succeeded", "failed", "cancelled", "skipped"]);

const JOB_RANK: Record<JobStatus, number> = {
  pending: 0,
  queued: 1,
  waiting: 2,
  running: 3,
  succeeded: 4,
  failed: 4,
  cancelled: 4,
  skipped: 4,
};

export const isBuildStatus = (value: unknown): value is BuildStatus =>
  typeof value === "string" && (BUILD_STATUSES as readonly string[]).includes(value);

export const isJobStatus = (value: unknown): value is JobStatus =>
  typeof value === "string" && (JOB_STATUSES as readonly string[]).includes(value);

export const isBuildSource = (value: unknown): value is BuildSource =>
  typeof value === "string" && (BUILD_SOURCES as readonly string[]).includes(value);

export const isTerminalBuildStatus = (status: BuildStatus): boolean => TERMINAL_BUILD.has(status);
export const isTerminalJobStatus = (status: JobStatus): boolean => TERMINAL_JOB.has(status);

/**
 * The status to keep when an update arrives. Webhooks are delivered out of order and redelivered,
 * so a status never moves backwards: a finished job stays finished and a running one never
 * returns to queued. Between two terminal states the newer report wins, which is how a re-run
 * replaces an earlier failure.
 */
export function mergeJobStatus(
  current: JobStatus | null | undefined,
  incoming: JobStatus,
): JobStatus {
  if (!current) return incoming;
  if (isTerminalJobStatus(current) && isTerminalJobStatus(incoming)) return incoming;
  return JOB_RANK[incoming] >= JOB_RANK[current] ? incoming : current;
}

/** The same rule for a whole run, except that a re-run (a higher attempt) starts it over. */
export function mergeBuildStatus(
  current: BuildStatus | null | undefined,
  incoming: BuildStatus,
  attempts: { current?: number | null; incoming?: number | null } = {},
): BuildStatus {
  if (!current) return incoming;
  if ((attempts.incoming ?? 0) > (attempts.current ?? 0)) return incoming;
  if ((attempts.incoming ?? 0) < (attempts.current ?? 0)) return current;
  if (isTerminalBuildStatus(current) && !isTerminalBuildStatus(incoming)) return current;
  if (current === "running" && incoming === "queued") return current;
  return incoming;
}

/** One job as the workflow file declares it, before anything has run. */
export interface PipelinePlanJob {
  /** The workflow's own identifier: the `jobs.<key>` of GitHub, the job name of GitLab. */
  key: string;
  /** What the provider will display; may differ from `key`. */
  name: string;
  needs: string[];
  stage: string | null;
  /** Held for a person before it runs: a protected environment, or `when: manual`. */
  gated: boolean;
  /** The job's own condition, verbatim, for display. */
  condition: string | null;
}

export interface PipelinePlan {
  provider: CiProvider;
  /** The workflow file the plan was read from. */
  source: string | null;
  stages: string[];
  jobs: PipelinePlanJob[];
}

export interface PipelineStep {
  number: number;
  name: string;
  status: JobStatus;
  started_at: string | null;
  completed_at: string | null;
}

export const PIPELINE_PLAN_LIMITS = { jobs: 200, needs: 50, name: 255 } as const;

/**
 * Columns for drawing a plan left to right. A job sits one column after the deepest job it needs;
 * a GitLab job with no `needs` sits after every earlier stage. Unknown and cyclic references are
 * ignored rather than trusted, since the plan comes from a file someone can edit.
 */
export function planColumns(plan: PipelinePlan): Map<string, number> {
  const jobs = new Map(plan.jobs.map((job) => [job.key, job]));
  const stageIndex = new Map(plan.stages.map((stage, index) => [stage, index]));
  const columns = new Map<string, number>();
  const visiting = new Set<string>();

  const stageFloor = (job: PipelinePlanJob): string[] => {
    if (job.needs.length > 0 || job.stage === null) return [];
    const own = stageIndex.get(job.stage);
    if (own === undefined || own === 0) return [];
    return plan.jobs
      .filter((other) => other.stage !== null && (stageIndex.get(other.stage) ?? -1) === own - 1)
      .map((other) => other.key);
  };

  const column = (key: string): number => {
    const known = columns.get(key);
    if (known !== undefined) return known;
    const job = jobs.get(key);
    if (!job || visiting.has(key)) return -1;
    visiting.add(key);
    const parents = [...job.needs, ...stageFloor(job)].filter((parent) => jobs.has(parent));
    let deepest = -1;
    for (const parent of parents) deepest = Math.max(deepest, column(parent));
    visiting.delete(key);
    const value = deepest + 1;
    columns.set(key, value);
    return value;
  };

  for (const job of plan.jobs) column(job.key);
  return columns;
}

/** The edges a plan draws: explicit `needs`, or the stage order when a GitLab job has none. */
export function planEdges(plan: PipelinePlan): Array<{ from: string; to: string }> {
  const keys = new Set(plan.jobs.map((job) => job.key));
  const stageIndex = new Map(plan.stages.map((stage, index) => [stage, index]));
  const edges: Array<{ from: string; to: string }> = [];
  for (const job of plan.jobs) {
    if (job.needs.length > 0) {
      for (const parent of job.needs)
        if (keys.has(parent)) edges.push({ from: parent, to: job.key });
      continue;
    }
    if (job.stage === null) continue;
    const own = stageIndex.get(job.stage) ?? 0;
    if (own === 0) continue;
    for (const other of plan.jobs) {
      if (other.stage !== null && stageIndex.get(other.stage) === own - 1) {
        edges.push({ from: other.key, to: job.key });
      }
    }
  }
  return edges;
}

function stripExpressions(name: string): string {
  return name.replace(/\$\{\{[^}]*\}\}/g, "").trim();
}

/**
 * Which planned job a running job is. Providers report the display name, which for a matrix job is
 * `name (a, b)` and for a templated name has its expressions resolved, so an exact match is tried
 * first, then the planned name with its expressions removed as a prefix. Null when nothing fits,
 * and the job is drawn on its own rather than attached to the wrong node.
 */
export function matchPlanJob(
  plan: PipelinePlan | null,
  reported: { name: string; key?: string | null },
): string | null {
  if (!plan) return null;
  if (reported.key) {
    const byKey = plan.jobs.find((job) => job.key === reported.key);
    if (byKey) return byKey.key;
  }
  const exact = plan.jobs.find((job) => job.name === reported.name || job.key === reported.name);
  if (exact) return exact.key;
  let best: { key: string; length: number } | null = null;
  for (const job of plan.jobs) {
    for (const candidate of [stripExpressions(job.name), job.key]) {
      if (!candidate || candidate.length < 2) continue;
      if (reported.name === candidate || reported.name.startsWith(`${candidate} (`)) {
        if (!best || candidate.length > best.length)
          best = { key: job.key, length: candidate.length };
      }
    }
  }
  return best?.key ?? null;
}

/** Validates a plan read back from storage or the wire; null when it is not one. */
export function parsePipelinePlan(value: unknown): PipelinePlan | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (raw.provider !== "github" && raw.provider !== "gitlab") return null;
  if (!Array.isArray(raw.jobs)) return null;
  const jobs: PipelinePlanJob[] = [];
  for (const entry of raw.jobs.slice(0, PIPELINE_PLAN_LIMITS.jobs)) {
    if (!entry || typeof entry !== "object") continue;
    const job = entry as Record<string, unknown>;
    if (typeof job.key !== "string" || !job.key) continue;
    jobs.push({
      key: job.key.slice(0, PIPELINE_PLAN_LIMITS.name),
      name:
        typeof job.name === "string" && job.name
          ? job.name.slice(0, PIPELINE_PLAN_LIMITS.name)
          : job.key,
      needs: Array.isArray(job.needs)
        ? job.needs
            .filter((need): need is string => typeof need === "string")
            .slice(0, PIPELINE_PLAN_LIMITS.needs)
        : [],
      stage: typeof job.stage === "string" ? job.stage : null,
      gated: job.gated === true,
      condition: typeof job.condition === "string" ? job.condition : null,
    });
  }
  return {
    provider: raw.provider,
    source: typeof raw.source === "string" ? raw.source : null,
    stages: Array.isArray(raw.stages)
      ? raw.stages.filter((stage): stage is string => typeof stage === "string")
      : [],
    jobs,
  };
}
