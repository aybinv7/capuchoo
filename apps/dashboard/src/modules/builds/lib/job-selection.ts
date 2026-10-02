import type { PipelineModel, PipelineNodeModel } from "./pipeline-graph";

/**
 * The job to open when the URL names none: the first failure, else the first job running, else
 * the first waiting (usually for an approval), else the last job that reported - which, once a
 * run has passed, is where it ended.
 */
export function defaultJobNode(nodes: readonly PipelineNodeModel[]): PipelineNodeModel | null {
  const first =
    nodes.find((node) => node.status === "failed") ??
    nodes.find((node) => node.status === "running") ??
    nodes.find((node) => node.status === "waiting");
  if (first) return first;
  for (let index = nodes.length - 1; index >= 0; index -= 1)
    if (nodes[index]!.job !== null) return nodes[index]!;
  return nodes[nodes.length - 1] ?? null;
}

/**
 * What `?job=` holds for a node: the job's row id, which survives a re-layout, or the node id for
 * a planned job no runner has picked up yet.
 */
export const selectionKey = (node: PipelineNodeModel): string => node.job?.id ?? node.id;

/** The node `?job=` names, else the default; a stale value (an older attempt) falls back too. */
export function resolveSelection(
  nodes: readonly PipelineNodeModel[],
  requested: string | null,
): PipelineNodeModel | null {
  if (requested) {
    const match = nodes.find((node) => node.job?.id === requested || node.id === requested);
    if (match) return match;
  }
  return defaultJobNode(nodes);
}

export interface JobGroup {
  column: number;
  /** The stage every job in the column shares (GitLab), else null. */
  label: string | null;
  nodes: PipelineNodeModel[];
}

/** Jobs grouped by graph column, left to right, empty columns left out. */
export function jobGroups(
  model: Pick<PipelineModel, "nodes" | "columns" | "columnStages">,
): JobGroup[] {
  const groups: JobGroup[] = Array.from({ length: model.columns }, (_, column) => ({
    column,
    label: model.columnStages[column] ?? null,
    nodes: [],
  }));
  for (const node of model.nodes) groups[node.column]?.nodes.push(node);
  return groups.filter((group) => group.nodes.length > 0);
}

/**
 * Whether too little of an element is on screen to notice it changed: its top is within `margin`
 * of the bottom of the viewport, or it ends above the top.
 */
export function isOffscreen(
  rect: Pick<DOMRect, "top" | "bottom">,
  viewportHeight: number,
  margin = 120,
): boolean {
  return rect.top > viewportHeight - margin || rect.bottom < margin;
}
