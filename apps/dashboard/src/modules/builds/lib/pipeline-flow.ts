import type { PipelineModel, PipelineNodeModel } from "./pipeline-graph";
import type { PipelineLayout } from "./pipeline-layout";

export interface StageLabelData {
  label: string;
}

interface FlowNodeBase {
  id: string;
  position: { x: number; y: number };
  draggable: false;
  selectable: false;
  connectable: false;
  /** The card inside a job node is the one keyboard stop; the wrapper is not a second one. */
  focusable: false;
}

export type FlowNode =
  | (FlowNodeBase & { type: "job"; data: PipelineNodeModel })
  | (FlowNodeBase & { type: "stage"; data: StageLabelData });

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  type: "default";
  animated: boolean;
  class: string;
}

const FIXED = {
  draggable: false,
  selectable: false,
  connectable: false,
  focusable: false,
} as const;

/** Vue Flow nodes for the run graph: one per job, plus a label per stage column. */
export function toFlowNodes(
  model: Pick<PipelineModel, "nodes">,
  layout: PipelineLayout,
): FlowNode[] {
  const jobs: FlowNode[] = model.nodes.map((node) => ({
    ...FIXED,
    id: node.id,
    type: "job",
    position: layout.positions.get(node.id) ?? { x: 0, y: 0 },
    data: node,
  }));
  const stages: FlowNode[] = layout.stageLabels.map((stage) => ({
    ...FIXED,
    id: `stage:${stage.column}`,
    type: "stage",
    position: { x: stage.x, y: stage.y },
    data: { label: stage.label },
  }));
  return [...stages, ...jobs];
}

export function toFlowEdges(model: Pick<PipelineModel, "edges">): FlowEdge[] {
  return model.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: "default",
    animated: edge.state === "active",
    class: `pipeline-edge pipeline-edge-${edge.state}`,
  }));
}

/** A string that changes exactly when the drawn edges do. */
export const edgeSignature = (edges: readonly FlowEdge[]): string =>
  edges.map((edge) => `${edge.id}:${edge.class}`).join("|");

export interface FlowNodeChanges {
  add: FlowNode[];
  remove: string[];
  update: FlowNode[];
}

function sameData(a: FlowNode, b: FlowNode): boolean {
  if (a.type === "stage" && b.type === "stage") return a.data.label === b.data.label;
  return a.data === b.data;
}

/**
 * What changed between two renders, so the graph is patched node by node instead of replaced.
 * A node whose model object and position are unchanged is left alone.
 */
export function diffFlowNodes(
  previous: ReadonlyMap<string, FlowNode>,
  next: readonly FlowNode[],
): FlowNodeChanges {
  const changes: FlowNodeChanges = { add: [], remove: [], update: [] };
  const seen = new Set<string>();
  for (const node of next) {
    seen.add(node.id);
    const before = previous.get(node.id);
    if (!before || before.type !== node.type) {
      if (before) changes.remove.push(node.id);
      changes.add.push(node);
      continue;
    }
    const moved = before.position.x !== node.position.x || before.position.y !== node.position.y;
    if (moved || !sameData(before, node)) changes.update.push(node);
  }
  for (const id of previous.keys()) if (!seen.has(id)) changes.remove.push(id);
  return changes;
}
