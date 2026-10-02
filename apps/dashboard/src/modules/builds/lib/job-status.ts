import type { JobStatus, PipelineStep } from "@capuchoo/core";
import type { Tone } from "@/shared/lib/tone";
import type { PipelineNodeModel } from "./pipeline-graph";

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  pending: "Not started",
  queued: "Queued",
  waiting: "Waiting",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
  cancelled: "Cancelled",
  skipped: "Skipped",
};

export const JOB_STATUS_TONE: Record<JobStatus, Tone> = {
  pending: "muted",
  queued: "muted",
  waiting: "warning",
  running: "info",
  succeeded: "success",
  failed: "danger",
  cancelled: "muted",
  skipped: "muted",
};

const FINISHED = new Set<JobStatus>(["succeeded", "failed", "cancelled", "skipped"]);

export const isJobFinished = (status: JobStatus): boolean => FINISHED.has(status);

/** The step a person looks for first: the failing one, else the one running. */
export function focusStep(steps: readonly PipelineStep[]): PipelineStep | null {
  return (
    steps.find((step) => step.status === "failed") ??
    steps.find((step) => step.status === "running") ??
    null
  );
}

/** One quiet line under a job's name, saying what it is doing or why it is not. */
export function jobCaption(
  node: Pick<PipelineNodeModel, "status" | "gated" | "job" | "condition">,
): string {
  const steps = node.job?.steps ?? [];
  const step = focusStep(steps);
  switch (node.status) {
    case "pending":
      if (node.gated) return "Not started · may need approval";
      return node.condition ? `Runs if ${node.condition}` : "Not started";
    case "queued":
      return node.job?.runner ? `Queued on ${node.job.runner}` : "Waiting for a runner";
    case "waiting":
      return node.gated ? "Waiting for approval" : "Waiting";
    case "running":
      if (!step) return node.job?.runner ? `Running on ${node.job.runner}` : "Running";
      return `${step.number}/${steps.length} · ${step.name}`;
    case "failed":
      return step ? `Failed at ${step.name}` : "Failed";
    case "succeeded":
      return steps.length ? `${steps.length} steps` : "Succeeded";
    case "cancelled":
      return "Cancelled";
    case "skipped":
      return node.condition ? `Skipped · ${node.condition}` : "Skipped";
  }
}

/** Seconds a step or job took, or null when it has not both started and finished. */
export function durationSeconds(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const value = (Date.parse(to) - Date.parse(from)) / 1000;
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : null;
}
