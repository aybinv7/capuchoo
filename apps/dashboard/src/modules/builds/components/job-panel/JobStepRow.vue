<script setup lang="ts">
import { ChevronRight, Circle, Copy } from "@lucide/vue";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import ElapsedTime from "@/shared/components/ElapsedTime.vue";
import type { StepView } from "../../lib/job-logs";
import JobStatusIcon from "../pipeline/JobStatusIcon.vue";

const props = defineProps<{ view: StepView; open: boolean; matches: number }>();
const emit = defineEmits<{ toggle: []; copy: [] }>();
</script>

<template>
  <Collapsible :open="props.open" @update:open="emit('toggle')">
    <div
      :class="
        cn(
          'flex items-center gap-1 pr-2',
          props.open && 'bg-muted/40',
          props.view.status === 'failed' && 'text-destructive',
        )
      "
    >
      <CollapsibleTrigger
        :class="
          cn(
            'hover:bg-muted/70 focus-visible:ring-ring/50 flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm outline-none focus-visible:ring-2',
            (props.view.status === 'skipped' || props.view.status === 'pending') &&
              'text-muted-foreground',
          )
        "
      >
        <ChevronRight
          :class="
            cn(
              'text-muted-foreground size-3.5 shrink-0 transition-transform',
              props.open && 'rotate-90',
            )
          "
        />
        <JobStatusIcon v-if="props.view.status" :status="props.view.status" class="size-3.5" />
        <Circle v-else class="text-muted-foreground/60 size-3.5 shrink-0" aria-hidden="true" />
        <span
          v-if="props.view.number !== null"
          class="text-muted-foreground w-5 shrink-0 text-right font-mono text-[11px] tabular"
          >{{ props.view.number }}</span
        >
        <span class="min-w-0 flex-1 truncate" :title="props.view.name">{{ props.view.name }}</span>
        <span
          v-if="props.matches"
          class="bg-warning-soft text-foreground shrink-0 rounded px-1.5 font-mono text-[10px] tabular"
          :aria-label="`${props.matches} matches`"
          >{{ props.matches }}</span
        >
        <span v-if="props.view.started_at" class="text-muted-foreground shrink-0 text-xs">
          <ElapsedTime :from="props.view.started_at" :to="props.view.completed_at" />
        </span>
      </CollapsibleTrigger>
      <button
        v-if="props.open && props.view.lines?.length"
        type="button"
        class="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/50 grid size-7 shrink-0 place-items-center rounded-md outline-none focus-visible:ring-2"
        :aria-label="`Copy the log of ${props.view.name}`"
        @click="emit('copy')"
      >
        <Copy class="size-3.5" />
      </button>
    </div>
    <CollapsibleContent class="border-t">
      <slot />
    </CollapsibleContent>
  </Collapsible>
</template>
