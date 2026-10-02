import type { JobStatus, PipelineStep } from "@capuchoo/core";
import type { BuildJob, BuildSource } from "@/shared/types/build";
import type {
  AvailableJobLogs,
  JobLogs,
  LogLine,
  LogLineKind,
  LogStep,
  LogsUnavailableReason,
} from "../types/job-logs.types";
import { isJobFinished } from "./job-status";
import { providerLabel } from "@/shared/lib/run-meta";

type Row = Record<string, unknown>;

const KINDS = new Set<LogLineKind>([
  "plain",
  "command",
  "group",
  "endgroup",
  "error",
  "warning",
  "notice",
  "debug",
]);
const REASONS = new Set<LogsUnavailableReason>([
  "running",
  "expired",
  "not_linked",
  "not_found",
  "unsupported",
]);
const SOURCES = new Set(["github", "gitlab", "archive"]);
const COMMAND_PREFIX = "[command]";

const isRow = (value: unknown): value is Row =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null => (typeof value === "string" ? value : null);

function normalizeLine(value: unknown): LogLine | null {
  if (!isRow(value)) return null;
  const raw = text(value.text);
  if (raw === null) return null;
  const declared = KINDS.has(value.kind as LogLineKind) ? (value.kind as LogLineKind) : "plain";
  const command =
    raw.startsWith(COMMAND_PREFIX) && (declared === "plain" || declared === "command");
  return {
    time: text(value.time),
    text: command ? raw.slice(COMMAND_PREFIX.length) : raw,
    kind: command ? "command" : declared,
  };
}

function normalizeLogStep(value: unknown, index: number): LogStep | null {
  if (!isRow(value)) return null;
  const number =
    typeof value.number === "number" && Number.isInteger(value.number) ? value.number : null;
  const lines = Array.isArray(value.lines)
    ? value.lines.map(normalizeLine).filter((line): line is LogLine => line !== null)
    : [];
  return { number, name: text(value.name) ?? `Section ${index + 1}`, lines };
}

/** The logs answer, total over a partial payload; anything that is not one is an error. */
export function normalizeJobLogs(value: unknown): JobLogs {
  if (!isRow(value) || typeof value.available !== "boolean")
    throw new Error("The server answered with something that is not a job log.");
  if (!value.available) {
    const reason = REASONS.has(value.reason as LogsUnavailableReason)
      ? (value.reason as LogsUnavailableReason)
      : "not_found";
    return { available: false, reason, html_url: text(value.html_url) };
  }
  return {
    available: true,
    source: SOURCES.has(value.source as string)
      ? (value.source as AvailableJobLogs["source"])
      : "archive",
    truncated: value.truncated === true,
    steps: Array.isArray(value.steps)
      ? value.steps.map(normalizeLogStep).filter((step): step is LogStep => step !== null)
      : [],
  };
}

/**
 * Whether to ask for a job's log: only once something on screen needs it, and never before the
 * job is over - the provider publishes the log at the end, so asking earlier only costs a call.
 */
export const shouldFetchLogs = (job: Pick<BuildJob, "status"> | null, wanted: boolean): boolean =>
  job !== null && wanted && isJobFinished(job.status);

/** One expandable row of a job's steps, with its log lines once they are loaded. */
export interface StepView {
  key: string;
  number: number | null;
  name: string;
  /** Null for a log section the provider reported outside any step. */
  status: JobStatus | null;
  started_at: string | null;
  completed_at: string | null;
  /** Null until the job's log is loaded. */
  lines: readonly LogLine[] | null;
}

export const WHOLE_LOG_KEY = "log";

export const stepKey = (number: number): string => `step:${number}`;

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function wholeLog(steps: readonly LogStep[]): LogLine[] {
  if (steps.length === 1) return steps[0]!.lines;
  return steps.flatMap((step) => [
    { time: step.lines[0]?.time ?? null, text: step.name, kind: "group" as const },
    ...step.lines,
  ]);
}

/**
 * The job's steps with their log lines. Lines go to the step of the same number; a section with
 * no number, or a number no step has, goes to the unclaimed step of the same name; what is still
 * left is listed after the steps. A job that reported no steps (GitLab) is one row holding the
 * whole log, each section as a group.
 */
export function jobStepViews(
  job: Pick<BuildJob, "steps" | "status" | "started_at" | "finished_at">,
  logs: Pick<AvailableJobLogs, "steps"> | null,
): StepView[] {
  const sections = logs?.steps ?? [];
  if (job.steps.length === 0) {
    return [
      {
        key: WHOLE_LOG_KEY,
        number: null,
        name: "Job log",
        status: job.status,
        started_at: job.started_at,
        completed_at: job.finished_at,
        lines: logs ? wholeLog(sections) : null,
      },
    ];
  }

  const numbers = new Set(job.steps.map((step) => step.number));
  const used = new Set<number>();
  const byNumber = new Map<number, number[]>();
  sections.forEach((section, index) => {
    if (section.number === null || !numbers.has(section.number)) return;
    const list = byNumber.get(section.number);
    if (list) list.push(index);
    else byNumber.set(section.number, [index]);
  });

  const claim = (step: PipelineStep): number[] => {
    const numbered = byNumber.get(step.number);
    if (numbered) return numbered;
    const named = sections.findIndex(
      (section, index) =>
        !used.has(index) &&
        (section.number === null || !numbers.has(section.number)) &&
        sameName(section.name, step.name),
    );
    return named === -1 ? [] : [named];
  };

  const views: StepView[] = job.steps.map((step) => {
    const claimed = logs ? claim(step) : [];
    for (const index of claimed) used.add(index);
    return {
      key: stepKey(step.number),
      number: step.number,
      name: step.name,
      status: step.status,
      started_at: step.started_at,
      completed_at: step.completed_at,
      lines: logs ? claimed.flatMap((index) => sections[index]!.lines) : null,
    };
  });

  sections.forEach((section, index) => {
    if (used.has(index) || section.lines.length === 0) return;
    views.push({
      key: `section:${index}`,
      number: null,
      name: section.name,
      status: null,
      started_at: null,
      completed_at: null,
      lines: section.lines,
    });
  });
  return views;
}

/** Why a log cannot be shown, in a sentence that says what to do instead. */
export function unavailableMessage(reason: LogsUnavailableReason, provider: BuildSource): string {
  const name = providerLabel(provider);
  switch (reason) {
    case "running":
      return provider === "gitlab"
        ? "Logs appear when the job finishes. GitLab shows them live meanwhile."
        : `Logs appear when the job finishes — ${name} only publishes them then.`;
    case "expired":
      return `${name} no longer keeps this log: it passed the repository's retention period before Capuchoo read it.`;
    case "not_linked":
      return `The repository is no longer linked to this app, so Capuchoo cannot read the log from ${name}.`;
    case "not_found":
      return `${name} has no log for this job.`;
    case "unsupported":
      return "Logs are only read from GitHub Actions and GitLab CI runs.";
  }
}
