import { PIPELINE_PLAN_LIMITS, type PipelinePlan, type PipelinePlanJob } from "@capuchoo/core";
import { parse } from "yaml";

const MAX_WORKFLOW_BYTES = 512 * 1024;

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const clip = (value: string) => value.slice(0, PIPELINE_PLAN_LIMITS.name);

function needsOf(value: unknown): string[] {
  const list = typeof value === "string" ? [value] : Array.isArray(value) ? value : [];
  return list
    .filter((need): need is string => typeof need === "string" && need.length > 0)
    .slice(0, PIPELINE_PLAN_LIMITS.needs);
}

function conditionOf(value: unknown): string | null {
  if (typeof value === "boolean") return String(value);
  return typeof value === "string" ? value.slice(0, 500) : null;
}

/**
 * The job graph of a GitHub workflow file. A job with an `environment` is marked gated because an
 * environment can require a reviewer; whether it does is only known once the run waits on it.
 * Returns null for a file that is not a workflow rather than throwing, since anyone with push
 * access writes this file.
 */
export function parseGithubWorkflowPlan(text: string, source: string): PipelinePlan | null {
  if (text.length > MAX_WORKFLOW_BYTES) return null;
  let document: unknown;
  try {
    document = parse(text, { maxAliasCount: 100, prettyErrors: false });
  } catch {
    return null;
  }
  const jobsNode = record(record(document)?.jobs);
  if (!jobsNode) return null;
  const jobs: PipelinePlanJob[] = [];
  for (const [key, value] of Object.entries(jobsNode).slice(0, PIPELINE_PLAN_LIMITS.jobs)) {
    const job = record(value);
    if (!job) continue;
    jobs.push({
      key: clip(key),
      name: typeof job.name === "string" && job.name ? clip(job.name) : clip(key),
      needs: needsOf(job.needs),
      stage: null,
      gated: job.environment !== undefined && job.environment !== null,
      condition: conditionOf(job.if),
    });
  }
  return jobs.length > 0 ? { provider: "github", source, stages: [], jobs } : null;
}
