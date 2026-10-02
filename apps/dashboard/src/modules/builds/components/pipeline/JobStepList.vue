<script setup lang="ts">
import type { PipelineStep } from "@capuchoo/core";
import { cn } from "@/lib/utils";
import ElapsedTime from "@/shared/components/ElapsedTime.vue";
import JobStatusIcon from "./JobStatusIcon.vue";

const props = defineProps<{ steps: readonly PipelineStep[] }>();
</script>

<template>
  <ol class="divide-y rounded-md border">
    <li
      v-for="step in props.steps"
      :key="step.number"
      :class="
        cn(
          'flex items-center gap-2.5 px-3 py-2 text-sm',
          step.status === 'failed' && 'bg-danger-soft/40',
          (step.status === 'skipped' || step.status === 'pending') && 'text-muted-foreground',
        )
      "
    >
      <JobStatusIcon :status="step.status" class="size-3.5" />
      <span class="text-muted-foreground w-5 shrink-0 text-right font-mono text-[11px] tabular">{{
        step.number
      }}</span>
      <span class="min-w-0 flex-1 truncate" :title="step.name">{{ step.name }}</span>
      <span v-if="step.started_at" class="text-muted-foreground shrink-0 text-xs">
        <ElapsedTime :from="step.started_at" :to="step.completed_at" />
      </span>
    </li>
  </ol>
</template>
