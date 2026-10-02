import { describeCiRun, githubDispatchInputs, type CiRunRequest } from "@capuchoo/core";
import type { Principal } from "../auth/principal";
import { actorColumns } from "../auth/principal";
import type { Build } from "../db/schema";
import type { Deps } from "../http/context";
import { upsertRun } from "../repositories/builds";
import { publishBuild } from "../services/build-feed";
import { asInstallation } from "./client";
import { workflowFile, type GithubLink } from "./repository-link";
import { recordJob, recordRun, schedulePlan } from "./run-ingest";
import { asRecord, asText, mapWorkflowJob, mapWorkflowRun } from "./run-mapper";

/**
 * Starts the linked workflow. GitHub answers with the run id, so the run is recorded before GitHub
 * has done anything and the dashboard can open it straight away.
 */
export async function dispatchGithubRun(
  deps: Deps,
  who: Principal,
  appId: string,
  link: GithubLink,
  request: CiRunRequest,
): Promise<{ build: Build | null; html_url: string | null }> {
  const github = asInstallation(deps, link.installationId);
  const answer = asRecord(
    await github.call<unknown>(
      "POST",
      `/repos/${link.repository}/actions/workflows/${encodeURIComponent(workflowFile(link))}/dispatches`,
      {
        body: { ref: request.ref, inputs: githubDispatchInputs(request), return_run_details: true },
      },
    ),
  );
  const runId = asText(answer.workflow_run_id, 32);
  const htmlUrl = asText(answer.html_url, 2000);
  if (!runId) return { build: null, html_url: `${link.htmlUrl}/actions` };

  const { build } = await upsertRun(deps.db, {
    app_id: appId,
    source: "github",
    external_id: runId,
    status: "queued",
    ref: request.ref,
    pipeline_url: htmlUrl,
    title: describeCiRun(request),
    workflow: link.workflowPath,
    trigger: "workflow_dispatch",
    ...actorColumns(who),
  });
  publishBuild(deps, build);
  schedulePlan(deps, build, link, link.workflowPath, request.ref);
  return { build, html_url: htmlUrl };
}

const runPath = (link: GithubLink, build: Build) =>
  `/repos/${link.repository}/actions/runs/${encodeURIComponent(build.external_id ?? "")}`;

export async function cancelGithubRun(deps: Deps, link: GithubLink, build: Build): Promise<void> {
  await asInstallation(deps, link.installationId).call("POST", `${runPath(link, build)}/cancel`, {
    allow: [409],
  });
}

export async function rerunGithubRun(
  deps: Deps,
  link: GithubLink,
  build: Build,
  failedOnly: boolean,
): Promise<void> {
  await asInstallation(deps, link.installationId).call(
    "POST",
    `${runPath(link, build)}/${failedOnly ? "rerun-failed-jobs" : "rerun"}`,
  );
}

/** Reads a run and its latest jobs back from GitHub, for when webhooks were missed. */
export async function syncGithubRun(deps: Deps, link: GithubLink, build: Build): Promise<Build> {
  const github = asInstallation(deps, link.installationId);
  const raw = await github.call<Record<string, unknown>>("GET", runPath(link, build), {
    allow: [404],
  });
  const run = raw ? mapWorkflowRun(raw, null, null) : null;
  if (!run) return build;
  const fresh = await recordRun(deps, build.app_id, run);
  schedulePlan(deps, fresh, link, run.path, run.headSha);
  const { items } = await github.list<Record<string, unknown>>(`${runPath(link, build)}/jobs`, {
    key: "jobs",
    query: { filter: "latest" },
    limit: 300,
  });
  for (const item of items) {
    const job = mapWorkflowJob(item);
    if (job) await recordJob(deps, fresh, job);
  }
  return fresh;
}

export async function githubRefs(deps: Deps, link: GithubLink) {
  const github = asInstallation(deps, link.installationId);
  const [branches, tags, repo] = await Promise.all([
    github.list<{ name?: string }>(`/repos/${link.repository}/branches`, { limit: 100 }),
    github.list<{ name?: string }>(`/repos/${link.repository}/tags`, { limit: 100 }),
    github.call<Record<string, unknown>>("GET", `/repos/${link.repository}`),
  ]);
  const names = (items: Array<{ name?: string }>) =>
    items.map((item) => item.name).filter((name): name is string => typeof name === "string");
  return {
    default_branch: asText(repo?.default_branch) ?? link.defaultBranch,
    branches: names(branches.items),
    tags: names(tags.items),
  };
}
