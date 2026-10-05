<script setup lang="ts">
import { Ban, RadioTower } from "@lucide/vue";
import { cn } from "@/lib/utils";
import type { ChannelState } from "@/content/channels";

const props = defineProps<{ name: string; kind: "release" | "client"; state: ChannelState }>();
</script>

<template>
  <div
    :class="
      cn(
        'relative min-h-[7.75rem] w-full rounded-xl border p-4 transition-[border-color,box-shadow] duration-500',
        'border-ink-border bg-ink-raised',
        props.state.changed && 'border-primary/60 shadow-[0_0_0_4px] shadow-primary/15',
        props.state.refused && 'border-[oklch(0.64_0.2_25)]/60',
      )
    "
  >
    <div class="mb-3 flex items-center gap-2">
      <RadioTower class="text-ink-muted size-3.5" aria-hidden="true" />
      <span class="text-ink-foreground font-mono text-sm">{{ props.name }}</span>
      <span
        class="border-ink-border text-ink-muted ml-auto rounded border px-1.5 py-px text-[10px] uppercase"
        >{{ props.kind }}</span
      >
    </div>
    <div class="flex items-baseline gap-2">
      <Transition
        mode="out-in"
        enter-active-class="transition duration-300"
        enter-from-class="translate-y-2 opacity-0"
        leave-active-class="transition duration-200"
        leave-to-class="-translate-y-2 opacity-0"
      >
        <span
          :key="props.state.version"
          class="text-ink-foreground font-mono text-2xl font-semibold tabular"
          >{{ props.state.version }}</span
        >
      </Transition>
      <span v-if="props.state.changed" class="text-primary text-xs font-medium">updated</span>
    </div>
    <p
      v-if="props.state.refused"
      class="mt-2 flex items-center gap-1.5 text-xs text-[oklch(0.72_0.17_25)]"
    >
      <Ban class="size-3.5 shrink-0" aria-hidden="true" />
      {{ props.state.refused }}
    </p>
  </div>
</template>
