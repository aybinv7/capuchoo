<script setup lang="ts">
import type { JobStatus, PipelineStep } from "@capuchoo/core";
import { computed } from "vue";
import { cn } from "@/lib/utils";

const props = defineProps<{ steps: readonly PipelineStep[]; status: JobStatus }>();

const SEGMENT: Record<JobStatus, string> = {
  pending: "bg-muted-foreground/15",
  queued: "bg-muted-foreground/25",
  waiting: "bg-warning/60",
  running: "bg-info animate-pulse motion-reduce:animate-none",
  succeeded: "bg-success/80",
  failed: "bg-destructive",
  cancelled: "bg-muted-foreground/40",
  skipped: "bg-muted-foreground/15",
};

const done = computed(
  () =>
    props.steps.filter((step) => step.status === "succeeded" || step.status === "skipped").length,
);
const label = computed(() =>
  props.steps.length ? `${done.value} of ${props.steps.length} steps done` : "No steps reported",
);
</script>

<template>
  <div class="flex h-1 w-full gap-px overflow-hidden rounded-full" role="img" :aria-label="label">
    <template v-if="props.steps.length">
      <span
        v-for="step in props.steps"
        :key="step.number"
        :class="
          cn(
            'h-full min-w-px flex-1 first:rounded-l-full last:rounded-r-full',
            SEGMENT[step.status],
          )
        "
      />
    </template>
    <span
      v-else
      :class="
        cn(
          'h-full w-full rounded-full',
          props.status === 'running' ? SEGMENT.running : 'bg-muted-foreground/15',
          props.status === 'succeeded' && SEGMENT.succeeded,
          props.status === 'failed' && SEGMENT.failed,
        )
      "
    />
  </div>
</template>
