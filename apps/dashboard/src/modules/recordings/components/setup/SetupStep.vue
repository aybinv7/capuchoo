<script setup lang="ts">
import { Check } from "@lucide/vue";
import { cn } from "@/lib/utils";

const props = defineProps<{
  index: number;
  title: string;
  description?: string;
  /** Proven by a device's health report, not merely read. */
  done?: boolean;
  last?: boolean;
}>();
</script>

<template>
  <li class="relative flex gap-4">
    <div class="flex flex-col items-center">
      <span
        :class="
          cn(
            'z-10 flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular transition-colors',
            props.done
              ? 'bg-success-soft border-success/50 text-success'
              : 'bg-background text-muted-foreground',
          )
        "
        :aria-label="props.done ? 'Done' : `Step ${props.index}`"
      >
        <Check v-if="props.done" class="size-3.5" aria-hidden="true" />
        <template v-else>{{ props.index }}</template>
      </span>
      <span v-if="!props.last" class="bg-border mt-1 w-px flex-1" aria-hidden="true" />
    </div>
    <div class="min-w-0 flex-1 space-y-3 pb-8">
      <div class="space-y-1 pt-0.5">
        <h2 class="text-sm font-semibold">{{ props.title }}</h2>
        <p v-if="props.description" class="text-muted-foreground max-w-prose text-sm text-pretty">
          {{ props.description }}
        </p>
      </div>
      <slot />
    </div>
  </li>
</template>
