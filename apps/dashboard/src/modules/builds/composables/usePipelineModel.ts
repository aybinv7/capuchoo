import { isTerminalBuildStatus } from "@capuchoo/core";
import { computed, type Ref } from "vue";
import type { BuildDetail } from "@/shared/types/build";
import {
  buildPipelineModel,
  pipelineProgress,
  type PipelineModel,
  type PipelineNodeModel,
} from "../lib/pipeline-graph";

const EMPTY: PipelineModel = { nodes: [], edges: [], columns: 0, columnStages: [], unattached: [] };

/**
 * The run graph of a pipeline build, recomputed from the cached detail. Nodes that did not change
 * keep their identity between recomputations, so only the job an event touched re-renders.
 */
export function usePipelineModel(detail: Ref<BuildDetail | undefined>) {
  let previous = new Map<string, PipelineNodeModel>();

  const model = computed<PipelineModel>(() => {
    const value = detail.value;
    if (!value) return EMPTY;
    const next = buildPipelineModel(
      {
        plan: value.plan,
        jobs: value.jobs,
        children: value.children,
        finished: isTerminalBuildStatus(value.status),
      },
      previous,
    );
    previous = new Map(next.nodes.map((node) => [node.id, node]));
    return next;
  });

  const upstream = computed(() => {
    const names = new Map(model.value.nodes.map((node) => [node.id, node.name]));
    const map = new Map<string, string[]>();
    for (const edge of model.value.edges) {
      const list = map.get(edge.target) ?? [];
      const name = names.get(edge.source);
      if (name && !list.includes(name)) list.push(name);
      map.set(edge.target, list);
    }
    return map;
  });

  return {
    model,
    progress: computed(() => pipelineProgress(model.value)),
    upstream,
  };
}
