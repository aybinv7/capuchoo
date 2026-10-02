import type { BuildCiRun, BuildStart } from "../services/wire.js";

export type CiContext = Pick<
  BuildStart,
  "source" | "commit" | "ref" | "pipeline_url" | "job_url"
> & {
  ci: BuildCiRun | null;
};

const RUN_ID = /^\d{1,20}$/;

function value(env: NodeJS.ProcessEnv, name: string): string | null {
  const raw = env[name]?.trim();
  return raw ? raw : null;
}

function attempt(raw: string | null): number | null {
  if (!raw || !/^\d{1,9}$/.test(raw)) return null;
  const parsed = Number(raw);
  return parsed > 0 ? parsed : null;
}

function ciRun(
  provider: BuildCiRun["provider"],
  runId: string | null,
  runAttempt: number | null,
  job: string | null,
): BuildCiRun | null {
  if (!runId || !RUN_ID.test(runId) || !job) return null;
  return { provider, run_id: runId, run_attempt: runAttempt, job: job.slice(0, 255) };
}

/** Where this deploy runs: GitLab CI, GitHub Actions, or a developer's machine. */
export function detectCiContext(env: NodeJS.ProcessEnv = process.env): CiContext {
  if (env.GITLAB_CI === "true" || value(env, "CI_PIPELINE_URL")) {
    return {
      source: "gitlab",
      commit: value(env, "CI_COMMIT_SHA"),
      ref: value(env, "CI_COMMIT_TAG") ?? value(env, "CI_COMMIT_REF_NAME"),
      pipeline_url: value(env, "CI_PIPELINE_URL"),
      job_url: value(env, "CI_JOB_URL"),
      ci: ciRun("gitlab", value(env, "CI_PIPELINE_ID"), null, value(env, "CI_JOB_NAME")),
    };
  }

  if (env.GITHUB_ACTIONS === "true") {
    const server = value(env, "GITHUB_SERVER_URL") ?? "https://github.com";
    const repository = value(env, "GITHUB_REPOSITORY");
    const runId = value(env, "GITHUB_RUN_ID");
    return {
      source: "github",
      commit: value(env, "GITHUB_SHA"),
      ref: value(env, "GITHUB_REF_NAME"),
      pipeline_url: repository && runId ? `${server}/${repository}/actions/runs/${runId}` : null,
      job_url: null,
      ci: ciRun(
        "github",
        runId,
        attempt(value(env, "GITHUB_RUN_ATTEMPT")),
        value(env, "GITHUB_JOB"),
      ),
    };
  }

  return { source: "cli", commit: null, ref: null, pipeline_url: null, job_url: null, ci: null };
}
