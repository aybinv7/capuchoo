import { isTerminalJobStatus, type PipelineStep } from "@capuchoo/core";
import { requireApp } from "../access/app-access";
import type { Principal } from "../auth/principal";
import type { Build, BuildJob } from "../db/schema";
import type { Deps } from "../http/context";
import { notFound } from "../lib/errors";
import { asInstallation } from "../github/client";
import { GithubApiError } from "../github/http";
import { requireGithubLink } from "../github/repository-link";
import { GitlabApiError, gitlabCall } from "../gitlab/client";
import { requireGitlabLink } from "../gitlab/runs";
import { findBuild } from "../repositories/builds";
import { archiveJobLog, findJob, findJobLog } from "../repositories/job-logs";
import { parseGithubLog, parseGitlabTrace, type LogStep } from "./job-log-parser";

const MAX_LOG_CHARS = 2 * 1024 * 1024;

export type JobLogs =
  | {
      available: true;
      source: "github" | "gitlab" | "archive";
      truncated: boolean;
      steps: LogStep[];
    }
  | {
      available: false;
      reason: "running" | "expired" | "not_linked" | "not_found" | "unsupported";
      html_url: string | null;
    };

const stepsOf = (job: BuildJob): PipelineStep[] =>
  Array.isArray(job.steps) ? (job.steps as PipelineStep[]) : [];

function parse(build: Build, job: BuildJob, content: string, truncated: boolean) {
  const parsed =
    build.source === "gitlab" ? parseGitlabTrace(content) : parseGithubLog(content, stepsOf(job));
  return { steps: parsed.steps, truncated: truncated || parsed.truncated };
}

async function fetchFromProvider(
  deps: Deps,
  build: Build,
  job: BuildJob,
): Promise<string | "expired" | "not_linked"> {
  try {
    if (build.source === "github") {
      const link = await requireGithubLink(deps, build.app_id);
      const text = await asInstallation(deps, link.installationId).call<unknown>(
        "GET",
        `/repos/${link.repository}/actions/jobs/${encodeURIComponent(job.external_id)}/logs`,
        { accept: "text/plain", allow: [404, 410] },
      );
      return typeof text === "string" ? text : "expired";
    }
    const link = await requireGitlabLink(deps, build.app_id);
    return await gitlabCall<string>(
      deps,
      link,
      "GET",
      `/jobs/${encodeURIComponent(job.external_id)}/trace`,
      {
        text: true,
      },
    );
  } catch (error) {
    if (error instanceof GithubApiError || error instanceof GitlabApiError) {
      if (error.status === 404 || error.status === 410) return "expired";
      throw error;
    }
    if (error && typeof error === "object" && "reason" in error) {
      const reason = String((error as { reason: unknown }).reason);
      if (reason === "github_not_linked" || reason === "gitlab_not_linked") return "not_linked";
    }
    throw error;
  }
}

/**
 * A job's log, split into its steps. A finished job's log is read from the provider once and kept,
 * so it stays readable after the provider expires it and costs no API call the second time.
 */
export async function jobLogs(
  deps: Deps,
  who: Principal,
  buildId: string,
  jobId: string,
): Promise<JobLogs> {
  const build = await findBuild(deps.db, buildId);
  if (!build) throw notFound("Build");
  await requireApp(deps.db, who, build.app_id, "viewer", "Reading job logs");
  const job = await findJob(deps.db, build.id, jobId);
  if (!job) throw notFound("Job");

  const archived = await findJobLog(deps.db, job.id);
  if (archived)
    return {
      available: true,
      source: "archive",
      ...parse(build, job, archived.content, archived.truncated),
    };
  if (build.source !== "github" && build.source !== "gitlab") {
    return { available: false, reason: "unsupported", html_url: job.url };
  }
  if (!isTerminalJobStatus(job.status))
    return { available: false, reason: "running", html_url: job.url };

  const fetched = await fetchFromProvider(deps, build, job);
  if (fetched === "expired" || fetched === "not_linked") {
    return { available: false, reason: fetched, html_url: job.url };
  }
  const truncated = fetched.length > MAX_LOG_CHARS;
  const content = truncated ? fetched.slice(0, MAX_LOG_CHARS) : fetched;
  await archiveJobLog(deps.db, job.id, content, truncated);
  return { available: true, source: build.source, ...parse(build, job, content, truncated) };
}
