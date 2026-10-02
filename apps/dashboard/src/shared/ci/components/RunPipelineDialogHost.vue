<script setup lang="ts">
import { defineAsyncComponent } from "vue";
import {
  loadRunPipelineDialog,
  type RunPipelineDialogController,
} from "../composables/useRunPipelineDialog";

const RunPipelineDialog = defineAsyncComponent(loadRunPipelineDialog);

const props = defineProps<{ controller: RunPipelineDialogController }>();
</script>

<template>
  <RunPipelineDialog
    v-if="props.controller.state.mounted"
    :open="props.controller.state.open"
    :preset="props.controller.state.preset"
    @update:open="props.controller.setOpen"
  />
</template>
