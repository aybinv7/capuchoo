import { describe, expect, it } from "vite-plus/test";
import { detectCiContext } from "./ci-context.js";

const GITLAB = {
  GITLAB_CI: "true",
  CI_COMMIT_SHA: "abc",
  CI_COMMIT_REF_NAME: "main",
  CI_PIPELINE_URL: "https://gitlab.example.com/p/-/pipelines/1",
  CI_JOB_URL: "https://gitlab.example.com/p/-/jobs/2",
  CI_PIPELINE_ID: "1",
  CI_JOB_NAME: "publish:ota",
};

const GITHUB = {
  GITHUB_ACTIONS: "true",
  GITHUB_SHA: "def",
  GITHUB_REF_NAME: "main",
  GITHUB_REPOSITORY: "acme/app",
  GITHUB_RUN_ID: "42",
  GITHUB_RUN_ATTEMPT: "3",
  GITHUB_JOB: "publish-ota",
};

describe("detectCiContext", () => {
  it("reads GitLab CI, with the pipeline as the run", () => {
    expect(detectCiContext(GITLAB)).toEqual({
      source: "gitlab",
      commit: "abc",
      ref: "main",
      pipeline_url: "https://gitlab.example.com/p/-/pipelines/1",
      job_url: "https://gitlab.example.com/p/-/jobs/2",
      ci: { provider: "gitlab", run_id: "1", run_attempt: null, job: "publish:ota" },
    });
  });

  it("prefers the tag on a GitLab tag pipeline", () => {
    expect(
      detectCiContext({ GITLAB_CI: "true", CI_COMMIT_TAG: "v2.4.0", CI_COMMIT_REF_NAME: "v2.4.0x" })
        .ref,
    ).toBe("v2.4.0");
  });

  it("reads GitHub Actions, with the run, its attempt and the job key", () => {
    expect(detectCiContext(GITHUB)).toEqual({
      source: "github",
      commit: "def",
      ref: "main",
      pipeline_url: "https://github.com/acme/app/actions/runs/42",
      job_url: null,
      ci: { provider: "github", run_id: "42", run_attempt: 3, job: "publish-ota" },
    });
  });

  it("has no run when the run id or the job is missing", () => {
    for (const name of ["CI_PIPELINE_ID", "CI_JOB_NAME"] as const) {
      expect(detectCiContext({ ...GITLAB, [name]: "" }).ci).toBeNull();
    }
    for (const name of ["GITHUB_RUN_ID", "GITHUB_JOB"] as const) {
      expect(detectCiContext({ ...GITHUB, [name]: " " }).ci).toBeNull();
    }
  });

  it("refuses a run id that is not a number", () => {
    expect(detectCiContext({ ...GITHUB, GITHUB_RUN_ID: "42; drop" }).ci).toBeNull();
    expect(detectCiContext({ ...GITLAB, CI_PIPELINE_ID: "abc" }).ci).toBeNull();
  });

  it("keeps the run without an attempt it cannot read", () => {
    for (const raw of [undefined, "", "0", "two", "1.5"]) {
      expect(detectCiContext({ ...GITHUB, GITHUB_RUN_ATTEMPT: raw }).ci).toEqual({
        provider: "github",
        run_id: "42",
        run_attempt: null,
        job: "publish-ota",
      });
    }
  });

  it("is a plain CLI run elsewhere", () => {
    expect(detectCiContext({})).toEqual({
      source: "cli",
      commit: null,
      ref: null,
      pipeline_url: null,
      job_url: null,
      ci: null,
    });
  });
});
