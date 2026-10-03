<script setup lang="ts">
import { CircleX, Info, TriangleAlert } from "@lucide/vue";
import { computed } from "vue";
import { cn } from "@/lib/utils";
import type { ConsoleLaneEntry } from "../../types/recordings.types";

const props = defineProps<{ entry: ConsoleLaneEntry }>();

const style = computed(() => {
  switch (props.entry.level) {
    case "error":
      return { icon: CircleX, text: "text-destructive" };
    case "warn":
      return { icon: TriangleAlert, text: "text-warning" };
    default:
      return { icon: Info, text: "text-muted-foreground" };
  }
});
</script>

<template>
  <component :is="style.icon" :class="cn('size-3.5 shrink-0', style.text)" aria-hidden="true" />
  <span
    :class="
      cn(
        'min-w-0 flex-1 truncate font-mono text-[11px]',
        props.entry.level === 'error' && 'text-destructive',
      )
    "
    :title="props.entry.text"
    >{{ props.entry.text }}</span
  >
</template>
