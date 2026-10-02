<script setup lang="ts">
import { Check } from "@lucide/vue";
import { cn } from "@/lib/utils";
import { PERIOD_PRESETS, type PeriodPreset } from "../lib/period";

const props = defineProps<{ active: PeriodPreset | null }>();
const emit = defineEmits<{ select: [preset: PeriodPreset] }>();
</script>

<template>
  <ul
    class="flex flex-wrap gap-1 border-b p-2 sm:w-44 sm:flex-col sm:flex-nowrap sm:gap-0.5 sm:border-r sm:border-b-0"
    aria-label="Presets"
  >
    <li v-for="preset in PERIOD_PRESETS" :key="preset.value">
      <button
        type="button"
        :aria-pressed="props.active === preset.value"
        :class="
          cn(
            'hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring/50 flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs outline-none focus-visible:ring-3 sm:text-sm',
            'max-sm:border',
            props.active === preset.value
              ? 'bg-accent text-accent-foreground font-medium'
              : 'text-muted-foreground',
          )
        "
        @click="emit('select', preset.value)"
      >
        {{ preset.label }}
        <Check v-if="props.active === preset.value" class="size-3.5 max-sm:hidden" />
      </button>
    </li>
  </ul>
</template>
