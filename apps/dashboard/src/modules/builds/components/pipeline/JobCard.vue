<script setup lang="ts">
import { computed } from "vue";
import { cn } from "@/lib/utils";
import ElapsedTime from "@/shared/components/ElapsedTime.vue";
import { JOB_STATUS_LABEL, jobCaption, jobEndedAt } from "../../lib/job-status";
import type { PipelineNodeModel } from "../../lib/pipeline-graph";
import DeployStepTrack from "./DeployStepTrack.vue";
import JobStatusIcon from "./JobStatusIcon.vue";
import JobStepStrip from "./JobStepStrip.vue";

const props = defineProps<{ node: PipelineNodeModel; selected?: boolean; class?: string }>();
const emit = defineEmits<{ open: [id: string] }>();

const SURFACE: Record<PipelineNodeModel["status"], string> = {
  pending: "border-dashed",
  queued: "",
  waiting: "border-dashed border-warning/60",
  running: "border-info/50 ring-1 ring-info/15",
  succeeded: "",
  failed: "border-destructive/50",
  cancelled: "opacity-70",
  skipped: "opacity-60",
};

const job = computed(() => props.node.job);
const caption = computed(() => jobCaption(props.node));
const endedAt = computed(() => jobEndedAt(job.value));
const label = computed(
  () =>
    `${props.node.name}, ${JOB_STATUS_LABEL[props.node.status]}. ${caption.value}. Show details`,
);
</script>

<template>
  <button
    type="button"
    :aria-label="label"
    :aria-current="props.selected ? 'true' : undefined"
    :class="
      cn(
        'bg-card hover:border-foreground/25 focus-visible:ring-ring/50 block w-full overflow-hidden rounded-lg border text-left shadow-xs transition-[border-color,box-shadow] outline-none focus-visible:ring-3',
        SURFACE[props.node.status],
        props.selected && 'border-primary ring-primary/25 ring-2',
        props.class,
      )
    "
    @click="emit('open', props.node.id)"
  >
    <div class="flex h-16 flex-col justify-center gap-1.5 px-3">
      <div class="flex items-center gap-2">
        <JobStatusIcon
          :status="props.node.status"
          :gated="props.node.gated && props.node.status === 'waiting'"
        />
        <span class="min-w-0 flex-1 truncate text-[13px] leading-tight font-medium">{{
          props.node.name
        }}</span>
        <span v-if="job?.started_at" class="text-muted-foreground shrink-0 text-[11px]">
          <ElapsedTime :from="job.started_at" :to="endedAt" />
        </span>
      </div>
      <JobStepStrip :steps="job?.steps ?? []" :status="props.node.status" />
      <p class="text-muted-foreground truncate text-[11px] leading-tight" :title="caption">
        {{ caption }}
      </p>
    </div>
    <div
      v-if="props.node.deploy"
      class="bg-surface/60 flex h-10 flex-col justify-center border-t px-3"
    >
      <DeployStepTrack :deploy="props.node.deploy" />
    </div>
  </button>
</template>
