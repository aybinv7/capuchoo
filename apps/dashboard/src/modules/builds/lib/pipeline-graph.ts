import {
  matchPlanJob,
  planColumns,
  planEdges,
  type JobStatus,
  type PipelinePlan,
  type PipelinePlanJob,
} from "@capuchoo/core";
import type { BuildChild, BuildJob } from "@/shared/types/build";

/** One box of the run graph: a planned job, a job the provider reported, or both. */
export interface PipelineNodeModel {
  id: string;
  key: string | null;
  name: string;
  status: JobStatus;
  column: number;
  row: number;
  stage: string | null;
  gated: boolean;
  condition: string | null;
  job: BuildJob | null;
  /** The Capuchoo deploy that reported from this job. */
  deploy: BuildChild | null;
}

export type EdgeState = "idle" | "active" | "done" | "failed" | "muted";

export interface PipelineEdgeModel {
  id: string;
  source: string;
  target: string;
  state: EdgeState;
}

export interface PipelineModel {
  nodes: PipelineNodeModel[];
  edges: PipelineEdgeModel[];
  columns: number;
  /** A label per column when every job in it shares a stage (GitLab), else null. */
  columnStages: Array<string | null>;
  /** Deploys whose job could not be found in the graph. */
  unattached: BuildChild[];
}

export interface PipelineInput {
  plan: PipelinePlan | null;
  jobs: readonly BuildJob[];
  children: readonly BuildChild[];
  /** A finished run draws planned jobs that never started as skipped rather than pending. */
  finished: boolean;
}

/**
 * A plan for a run that has none: GitLab jobs grouped by stage in the order they appear, or a
 * single column of GitHub jobs. Keys are the job names, so matching falls through to them.
 */
export function synthesizePlan(jobs: readonly BuildJob[]): PipelinePlan {
  const stages: string[] = [];
  const planned = new Map<string, PipelinePlanJob>();
  for (const job of jobs) {
    if (job.stage && !stages.includes(job.stage)) stages.push(job.stage);
    const key = job.plan_key ?? job.name;
    if (planned.has(key)) continue;
    planned.set(key, {
      key,
      name: job.name,
      needs: [],
      stage: job.stage,
      gated: false,
      condition: null,
    });
  }
  return { provider: "gitlab", source: null, stages, jobs: [...planned.values()] };
}

/** One row per job: the highest attempt wins, then the most recently updated. */
export function latestAttempts(jobs: readonly BuildJob[]): BuildJob[] {
  const latest = new Map<string, BuildJob>();
  for (const job of jobs) {
    const id = `${job.plan_key ?? ""}\u0000${job.name}`;
    const current = latest.get(id);
    if (
      !current ||
      job.attempt > current.attempt ||
      (job.attempt === current.attempt && job.updated_at > current.updated_at)
    ) {
      latest.set(id, job);
    }
  }
  return [...latest.values()];
}

function edgeState(target: JobStatus): EdgeState {
  switch (target) {
    case "running":
      return "active";
    case "queued":
    case "waiting":
      return "idle";
    case "succeeded":
      return "done";
    case "failed":
      return "failed";
    default:
      return "muted";
  }
}

const NODE_KEYS: readonly (keyof PipelineNodeModel)[] = [
  "id",
  "key",
  "name",
  "status",
  "column",
  "row",
  "stage",
  "gated",
  "condition",
  "job",
  "deploy",
];

function sameNode(a: PipelineNodeModel, b: PipelineNodeModel): boolean {
  return NODE_KEYS.every((field) => a[field] === b[field]);
}

/**
 * The run as a graph: plan jobs in `planColumns` order, merged with the reported jobs by
 * `matchPlanJob`, jobs the plan does not know in a last column, and each deploy attached to the
 * job it ran in. Pass the previous result's nodes as `previous` and every node that did not
 * change is returned as the same object, so a renderer can update one node by identity.
 */
export function buildPipelineModel(
  input: PipelineInput,
  previous?: ReadonlyMap<string, PipelineNodeModel>,
): PipelineModel {
  const jobs = latestAttempts(input.jobs);
  const plan = input.plan && input.plan.jobs.length > 0 ? input.plan : synthesizePlan(jobs);
  const columns = planColumns(plan);

  const byKey = new Map<string, BuildJob[]>();
  const unmatched: BuildJob[] = [];
  for (const job of jobs) {
    const key = matchPlanJob(plan, { name: job.name, key: job.plan_key });
    if (key === null) {
      unmatched.push(job);
      continue;
    }
    const list = byKey.get(key);
    if (list) list.push(job);
    else byKey.set(key, [job]);
  }

  const deploys = new Map<string, BuildChild>();
  const unattached: BuildChild[] = [];
  for (const child of [...input.children].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  )) {
    const key = child.job_key
      ? matchPlanJob(plan, { name: child.job_key, key: child.job_key })
      : null;
    if (key) deploys.set(key, child);
    else unattached.push(child);
  }

  const drafts: Omit<PipelineNodeModel, "row">[] = [];
  let lastColumn = -1;
  for (const planned of plan.jobs) {
    const column = Math.max(0, columns.get(planned.key) ?? 0);
    lastColumn = Math.max(lastColumn, column);
    const reported = (byKey.get(planned.key) ?? []).sort((a, b) => a.name.localeCompare(b.name));
    const base = {
      key: planned.key,
      column,
      stage: planned.stage,
      gated: planned.gated,
      condition: planned.condition,
    };
    if (reported.length === 0) {
      drafts.push({
        ...base,
        id: `plan:${planned.key}`,
        name: planned.name,
        status: input.finished ? "skipped" : "pending",
        job: null,
        deploy: deploys.get(planned.key) ?? null,
      });
      continue;
    }
    reported.forEach((job, index) => {
      drafts.push({
        ...base,
        id: index === 0 ? `plan:${planned.key}` : `plan:${planned.key}#${job.name}`,
        name: job.name,
        stage: job.stage ?? planned.stage,
        status: job.status,
        job,
        deploy: index === 0 ? (deploys.get(planned.key) ?? null) : null,
      });
    });
  }
  for (const job of unmatched.sort((a, b) => a.name.localeCompare(b.name))) {
    drafts.push({
      id: `job:${job.external_id}`,
      key: job.plan_key,
      name: job.name,
      status: job.status,
      column: lastColumn + 1,
      stage: job.stage,
      gated: false,
      condition: null,
      job,
      deploy: null,
    });
  }

  const rows = new Map<number, number>();
  const nodes = drafts.map((draft) => {
    const row = rows.get(draft.column) ?? 0;
    rows.set(draft.column, row + 1);
    const node: PipelineNodeModel = { ...draft, row };
    const before = previous?.get(node.id);
    return before && sameNode(before, node) ? before : node;
  });

  const nodesByKey = new Map<string, PipelineNodeModel[]>();
  for (const node of nodes) {
    if (node.key === null) continue;
    const list = nodesByKey.get(node.key);
    if (list) list.push(node);
    else nodesByKey.set(node.key, [node]);
  }
  const edges: PipelineEdgeModel[] = [];
  for (const { from, to } of planEdges(plan)) {
    for (const source of nodesByKey.get(from) ?? []) {
      for (const target of nodesByKey.get(to) ?? []) {
        edges.push({
          id: `${source.id}->${target.id}`,
          source: source.id,
          target: target.id,
          state: edgeState(target.status),
        });
      }
    }
  }

  const columnCount = nodes.reduce((max, node) => Math.max(max, node.column + 1), 0);
  const columnStages = Array.from({ length: columnCount }, (_, column) => {
    const stages = new Set(
      nodes.filter((node) => node.column === column).map((node) => node.stage),
    );
    const [only] = stages;
    return stages.size === 1 && only ? only : null;
  });

  return { nodes, edges, columns: columnCount, columnStages, unattached };
}

export interface JobProgress {
  total: number;
  finished: number;
  failed: number;
  running: number;
}

/** How far a run has got, counting the latest attempt of each drawn job. */
export function pipelineProgress(model: Pick<PipelineModel, "nodes">): JobProgress {
  const progress: JobProgress = { total: 0, finished: 0, failed: 0, running: 0 };
  for (const node of model.nodes) {
    progress.total += 1;
    if (node.status === "running") progress.running += 1;
    if (node.status === "failed") progress.failed += 1;
    if (["succeeded", "failed", "cancelled", "skipped"].includes(node.status))
      progress.finished += 1;
  }
  return progress;
}
