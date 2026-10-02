import type { PipelineModel, PipelineNodeModel } from "./pipeline-graph";

export const PIPELINE_LAYOUT = {
  nodeWidth: 240,
  nodeHeight: 66,
  deployHeight: 41,
  columnGap: 64,
  rowGap: 16,
  stageHeight: 28,
} as const;

export interface PipelineLayout {
  positions: Map<string, { x: number; y: number }>;
  /** Top-left of each column's stage label, when the column has one. */
  stageLabels: Array<{ column: number; label: string; x: number; y: number }>;
  width: number;
  height: number;
}

/** The drawn height of a node: a deploy adds its step track. */
export const nodeHeight = (node: PipelineNodeModel): number =>
  PIPELINE_LAYOUT.nodeHeight + (node.deploy ? PIPELINE_LAYOUT.deployHeight : 0);

/**
 * Columns left to right, rows top to bottom, each column centred on the tallest so a fan-in
 * reads as one. Deterministic: same model, same picture.
 */
export function layoutPipeline(
  model: Pick<PipelineModel, "nodes" | "columnStages">,
): PipelineLayout {
  const { nodeWidth, columnGap, rowGap, stageHeight } = PIPELINE_LAYOUT;
  const columns = new Map<number, PipelineNodeModel[]>();
  for (const node of model.nodes) {
    const list = columns.get(node.column);
    if (list) list.push(node);
    else columns.set(node.column, [node]);
  }
  const heightOf = (nodes: readonly PipelineNodeModel[]) =>
    nodes.reduce((sum, node) => sum + nodeHeight(node), 0) + Math.max(0, nodes.length - 1) * rowGap;

  let tallest = 0;
  for (const nodes of columns.values()) tallest = Math.max(tallest, heightOf(nodes));
  const top = model.columnStages.some(Boolean) ? stageHeight : 0;

  const positions = new Map<string, { x: number; y: number }>();
  for (const [column, nodes] of columns) {
    const sorted = [...nodes].sort((a, b) => a.row - b.row);
    let y = top + (tallest - heightOf(sorted)) / 2;
    for (const node of sorted) {
      positions.set(node.id, { x: column * (nodeWidth + columnGap), y: Math.round(y) });
      y += nodeHeight(node) + rowGap;
    }
  }

  const stageLabels = model.columnStages.flatMap((label, column) =>
    label ? [{ column, label, x: column * (nodeWidth + columnGap), y: 0 }] : [],
  );
  const columnCount = columns.size === 0 ? 0 : Math.max(...columns.keys()) + 1;
  return {
    positions,
    stageLabels,
    width: Math.max(0, columnCount * (nodeWidth + columnGap) - columnGap),
    height: top + tallest,
  };
}
