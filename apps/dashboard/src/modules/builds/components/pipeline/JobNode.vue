<script setup lang="ts">
import { Handle, Position } from "@vue-flow/core";
import type { PipelineNodeModel } from "../../lib/pipeline-graph";
import { PIPELINE_LAYOUT } from "../../lib/pipeline-layout";
import JobCard from "./JobCard.vue";

defineOptions({ inheritAttrs: false });

const props = defineProps<{ node: PipelineNodeModel; selected: boolean }>();
</script>

<template>
  <div class="nopan pointer-events-auto" :style="{ width: `${PIPELINE_LAYOUT.nodeWidth}px` }">
    <Handle
      type="target"
      :position="Position.Left"
      :connectable="false"
      class="!size-1.5 !min-h-0 !min-w-0 !border-0 !bg-transparent"
    />
    <JobCard :node="props.node" :selected="props.selected" />
    <Handle
      type="source"
      :position="Position.Right"
      :connectable="false"
      class="!size-1.5 !min-h-0 !min-w-0 !border-0 !bg-transparent"
    />
  </div>
</template>
