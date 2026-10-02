import type { Build } from "@/shared/types/build";

const TRIGGERS: Record<string, string> = {
  push: "Push",
  pull_request: "Pull request",
  pull_request_target: "Pull request",
  merge_request_event: "Merge request",
  workflow_dispatch: "Started from Capuchoo",
  api: "Started from Capuchoo",
  trigger: "Triggered",
  web: "Started in GitLab",
  tag: "Tag",
  schedule: "Schedule",
  release: "Release",
  repository_dispatch: "Dispatch",
  pipeline: "Parent pipeline",
};

/** How a run started, in words: `workflow_dispatch` reads as "Started from Capuchoo". */
export function triggerLabel(trigger: string | null | undefined): string | null {
  if (!trigger) return null;
  return TRIGGERS[trigger] ?? trigger.replace(/_/g, " ");
}

export const providerLabel = (source: Build["source"]): string =>
  source === "github" ? "GitHub" : source === "gitlab" ? "GitLab" : "CI";

/** A run's title: the commit or dispatch title, else the workflow, else its provider id. */
export function runTitle(
  build: Pick<Build, "title" | "workflow" | "external_id" | "source">,
): string {
  if (build.title) return build.title;
  if (build.workflow) return build.workflow;
  return build.external_id
    ? `${providerLabel(build.source)} run ${build.external_id}`
    : "Pipeline run";
}

/** A deploy's title: `OTA 1.4.2 → production`. */
export function deployTitle(build: Pick<Build, "kind" | "version_name" | "channel_name">): string {
  const version = build.version_name ? ` ${build.version_name}` : "";
  const channel = build.channel_name ? ` → ${build.channel_name}` : "";
  return `${build.kind.toUpperCase()}${version}${channel}`;
}

/** The title a build page shows, whichever kind of run it is. */
export const buildTitle = (build: Build): string =>
  build.kind === "pipeline" ? runTitle(build) : deployTitle(build);

/** Whether a ref names a tag rather than a branch, as far as the run tells. */
export const isTagRef = (build: Pick<Build, "ref" | "trigger">): boolean =>
  build.trigger === "tag" || (build.ref ?? "").startsWith("refs/tags/");

export const displayRef = (ref: string | null): string | null =>
  ref ? ref.replace(/^refs\/(heads|tags)\//, "") : null;
