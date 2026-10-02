import { computed, type Ref } from "vue";
import { useQueryParam } from "@/shared/composables/useQueryParam";
import { resolveSelection, selectionKey } from "../lib/job-selection";
import type { PipelineNodeModel } from "../lib/pipeline-graph";

/**
 * The job open in the panel, kept in `?job=` so a link opens the same job. Selecting replaces the
 * history entry rather than pushing one, and selecting the open job writes nothing.
 */
export function useJobSelection(nodes: Readonly<Ref<readonly PipelineNodeModel[]>>) {
  const requested = useQueryParam<string>("job", "");

  const selected = computed(() => resolveSelection(nodes.value, requested.value || null));

  function select(id: string) {
    const node = nodes.value.find((entry) => entry.id === id);
    if (!node) return;
    const key = selectionKey(node);
    if (requested.value !== key) requested.value = key;
  }

  return { selected, select };
}
