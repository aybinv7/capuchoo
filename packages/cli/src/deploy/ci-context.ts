import type { BuildStart } from "../services/wire.js";

export type CiContext = Pick<BuildStart, "source" | "commit" | "ref" | "pipeline_url" | "job_url">;

function value(env: NodeJS.ProcessEnv, name: string): string | null {
  const raw = env[name]?.trim();
  return raw ? raw : null;
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
    };
  }

  return { source: "cli", commit: null, ref: null, pipeline_url: null, job_url: null };
}
