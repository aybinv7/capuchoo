<script setup lang="ts">
import { Check, Copy } from "@lucide/vue";
import { useClipboard } from "@vueuse/core";
import { cn } from "@/lib/utils";

const props = withDefaults(defineProps<{ command: string; tone?: "default" | "ink" }>(), {
  tone: "default",
});

const { copy, copied, isSupported } = useClipboard({ legacy: true, copiedDuring: 1600 });
</script>

<template>
  <div
    :class="
      cn(
        'group flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 font-mono text-[13px]',
        props.tone === 'ink'
          ? 'border-ink-border bg-ink text-ink-foreground'
          : 'bg-card text-card-foreground',
      )
    "
  >
    <span class="text-primary select-none" aria-hidden="true">$</span>
    <code class="min-w-0 flex-1 truncate" :title="props.command">{{ props.command }}</code>
    <button
      v-if="isSupported"
      type="button"
      class="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 shrink-0 rounded p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
      :aria-label="copied ? 'Copied' : `Copy ${props.command}`"
      @click="copy(props.command)"
    >
      <Check v-if="copied" class="text-success size-3.5" />
      <Copy v-else class="size-3.5" />
    </button>
  </div>
</template>
