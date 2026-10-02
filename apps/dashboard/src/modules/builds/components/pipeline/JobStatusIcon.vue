<script setup lang="ts">
import type { JobStatus } from "@capuchoo/core";
import {
  Ban,
  CircleCheck,
  CircleDashed,
  CircleMinus,
  CirclePause,
  CircleX,
  LoaderCircle,
  Lock,
} from "@lucide/vue";
import { computed, type Component } from "vue";
import { cn } from "@/lib/utils";
import { JOB_STATUS_LABEL } from "../../lib/job-status";

const props = withDefaults(defineProps<{ status: JobStatus; gated?: boolean; class?: string }>(), {
  gated: false,
});

const ICON: Record<JobStatus, Component> = {
  pending: CircleDashed,
  queued: CircleDashed,
  waiting: CirclePause,
  running: LoaderCircle,
  succeeded: CircleCheck,
  failed: CircleX,
  cancelled: Ban,
  skipped: CircleMinus,
};

const COLOR: Record<JobStatus, string> = {
  pending: "text-muted-foreground/60",
  queued: "text-muted-foreground",
  waiting: "text-warning",
  running: "text-info animate-spin [animation-duration:1.6s] motion-reduce:animate-none",
  succeeded: "text-success",
  failed: "text-destructive",
  cancelled: "text-muted-foreground",
  skipped: "text-muted-foreground/60",
};

const locked = computed(
  () => props.gated && (props.status === "pending" || props.status === "waiting"),
);
const icon = computed(() => (locked.value ? Lock : ICON[props.status]));
const label = computed(() =>
  locked.value
    ? `${JOB_STATUS_LABEL[props.status]}, needs approval`
    : JOB_STATUS_LABEL[props.status],
);
</script>

<template>
  <component
    :is="icon"
    role="img"
    :aria-label="label"
    :class="cn('size-4 shrink-0', COLOR[props.status], props.class)"
  />
</template>
