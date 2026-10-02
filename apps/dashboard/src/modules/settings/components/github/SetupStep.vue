<script setup lang="ts">
import { Check, Clock, TriangleAlert } from "@lucide/vue";
import { cn } from "@/lib/utils";
import type { StepState } from "../../lib/github-setup";

const props = defineProps<{ index: number; title: string; state: StepState; last?: boolean }>();

const MARK: Record<StepState, string> = {
  done: "bg-success text-white border-success",
  todo: "border-foreground/40 text-foreground",
  attention: "border-warning bg-warning-soft text-warning",
  waiting: "border-info bg-info-soft text-info",
  optional: "border-dashed border-muted-foreground/50 text-muted-foreground",
};

const LABEL: Record<StepState, string> = {
  done: "Done",
  todo: "To do",
  attention: "Needs attention",
  waiting: "Waiting",
  optional: "Optional",
};
</script>

<template>
  <li class="relative grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-4">
    <span
      v-if="!props.last"
      class="bg-border absolute top-8 bottom-0 left-[0.8125rem] w-px"
      aria-hidden="true"
    />
    <span
      :class="
        cn(
          'relative z-10 flex size-7 items-center justify-center rounded-full border text-xs font-semibold tabular',
          MARK[props.state],
        )
      "
    >
      <Check v-if="props.state === 'done'" class="size-3.5" />
      <TriangleAlert v-else-if="props.state === 'attention'" class="size-3.5" />
      <Clock v-else-if="props.state === 'waiting'" class="size-3.5" />
      <template v-else>{{ props.index }}</template>
      <span class="sr-only">{{ LABEL[props.state] }}</span>
    </span>
    <div :class="cn('min-w-0 space-y-2', !props.last && 'pb-7')">
      <div class="flex min-h-7 flex-wrap items-center gap-x-2 gap-y-1">
        <h3 class="text-sm font-medium">{{ props.title }}</h3>
        <span
          v-if="props.state === 'optional'"
          class="text-muted-foreground rounded border px-1 text-[10px] uppercase"
          >optional</span
        >
        <div v-if="$slots.status" class="text-muted-foreground ml-auto text-xs">
          <slot name="status" />
        </div>
      </div>
      <slot />
    </div>
  </li>
</template>
