<script setup lang="ts">
import { computed } from "vue";
import type { PipelineModel } from "../../lib/pipeline-graph";
import JobCard from "./JobCard.vue";

const props = defineProps<{ model: PipelineModel; selectedId: string | null }>();
const emit = defineEmits<{ open: [id: string] }>();

const columns = computed(() =>
  Array.from({ length: props.model.columns }, (_, column) => ({
    column,
    label: props.model.columnStages[column] ?? null,
    nodes: props.model.nodes.filter((node) => node.column === column),
  })).filter((entry) => entry.nodes.length > 0),
);
</script>

<template>
  <ol class="space-y-4">
    <li v-for="entry in columns" :key="entry.column" class="space-y-2">
      <p class="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
        {{ entry.label ?? `Step ${entry.column + 1}` }}
      </p>
      <ul class="border-border space-y-2 border-l pl-3">
        <li v-for="node in entry.nodes" :key="node.id">
          <JobCard
            :node="node"
            :selected="node.id === props.selectedId"
            @open="emit('open', $event)"
          />
        </li>
      </ul>
    </li>
  </ol>
</template>
