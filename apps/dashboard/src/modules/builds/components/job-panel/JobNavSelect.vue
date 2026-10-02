<script setup lang="ts">
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@/components/ui/native-select";
import type { JobGroup } from "../../lib/job-selection";
import { JOB_STATUS_LABEL } from "../../lib/job-status";

const props = defineProps<{ groups: readonly JobGroup[]; selectedId: string | null }>();
const emit = defineEmits<{ select: [id: string] }>();

function change(value: unknown) {
  if (typeof value === "string" && value) emit("select", value);
}
</script>

<template>
  <NativeSelect
    :model-value="props.selectedId ?? ''"
    aria-label="Job"
    class="h-9 w-full"
    @update:model-value="change"
  >
    <template v-for="group in props.groups" :key="group.column">
      <NativeSelectOptGroup v-if="group.label" :label="group.label">
        <NativeSelectOption v-for="node in group.nodes" :key="node.id" :value="node.id">
          {{ node.name }} — {{ JOB_STATUS_LABEL[node.status] }}
        </NativeSelectOption>
      </NativeSelectOptGroup>
      <template v-else>
        <NativeSelectOption v-for="node in group.nodes" :key="node.id" :value="node.id">
          {{ node.name }} — {{ JOB_STATUS_LABEL[node.status] }}
        </NativeSelectOption>
      </template>
    </template>
  </NativeSelect>
</template>
