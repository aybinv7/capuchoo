<script setup lang="ts">
import { BaseEdge, type EdgeProps } from "@vue-flow/core";
import { computed } from "vue";
import { wirePath, type WireData } from "../../lib/wires";

defineOptions({ inheritAttrs: false });

const props = defineProps<EdgeProps<WireData>>();

const STRAIGHT: WireData = {
  exitTrack: 0,
  entryTrack: 0,
  busY: null,
  sourcePort: 0,
  targetPort: 0,
};

const geometry = computed(() =>
  wirePath(
    {
      sourceX: props.sourceX,
      sourceY: props.sourceY,
      targetX: props.targetX,
      targetY: props.targetY,
    },
    props.data ?? STRAIGHT,
  ),
);
</script>

<template>
  <BaseEdge
    :id="props.id"
    :path="geometry.path"
    :label="props.label"
    :label-x="geometry.labelX"
    :label-y="geometry.labelY"
    :label-show-bg="true"
    :label-bg-padding="[4, 2]"
    :label-bg-border-radius="3"
    :marker-end="props.markerEnd"
    :style="props.style"
    :interaction-width="0"
  />
</template>
