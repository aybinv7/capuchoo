<script setup lang="ts">
import { computed } from "vue";
import { cn } from "@/lib/utils";
import { startStyle } from "@/shared/recording/start";
import { TONE_SOFT, TONE_TEXT } from "@/shared/lib/tone-styles";

const props = defineProps<{ start: string; class?: string }>();
const style = computed(() => startStyle(props.start));
</script>

<template>
  <span
    :title="style.description"
    :class="
      cn(
        'inline-flex h-5 items-center gap-1 rounded-full px-2 text-[11px] font-medium whitespace-nowrap',
        TONE_SOFT[style.tone],
        TONE_TEXT[style.tone],
        props.class,
      )
    "
  >
    <component :is="style.icon" class="size-3" aria-hidden="true" />
    {{ style.label }}
  </span>
</template>
