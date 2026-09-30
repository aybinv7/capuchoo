<script setup lang="ts">
import { CircleCheck } from "@lucide/vue";
import type { TerminalLine } from "@/content/cli";

const props = defineProps<{ lines: readonly TerminalLine[]; title?: string }>();
</script>

<template>
  <div
    class="border-ink-border overflow-hidden rounded-xl border bg-[oklch(0.17_0.003_100)] font-mono text-[13px] shadow-2xl shadow-black/30"
  >
    <div
      class="border-ink-border flex h-10 items-center gap-2 border-b bg-[oklch(0.21_0.003_100)] px-4"
    >
      <span class="size-3 rounded-full bg-[#ff5f57]/80" />
      <span class="size-3 rounded-full bg-[#febc2e]/80" />
      <span class="size-3 rounded-full bg-[#28c840]/80" />
      <span class="text-ink-muted ml-auto text-xs">{{ props.title ?? "terminal" }}</span>
    </div>
    <div class="min-h-56 space-y-2 p-5" role="log" aria-live="polite">
      <template v-for="(line, index) in props.lines" :key="`${index}-${line.text}`">
        <div v-if="line.kind === 'command'" class="flex gap-2 break-all">
          <span class="text-primary shrink-0 font-bold" aria-hidden="true">➜</span>
          <span class="text-ink-foreground">{{ line.text }}</span>
        </div>
        <div
          v-else-if="line.kind === 'success'"
          class="border-ink-border flex items-center gap-2 rounded-md border bg-white/[0.03] px-3 py-2 text-[oklch(0.8_0.14_150)]"
        >
          <CircleCheck class="size-4 shrink-0" />
          {{ line.text }}
        </div>
        <div
          v-else
          class="border-ink-border ml-1 border-l pl-4 whitespace-pre-wrap"
          :class="line.kind === 'muted' ? 'text-ink-muted/70 italic' : 'text-ink-muted'"
        >
          {{ line.text }}
        </div>
      </template>
      <div class="flex gap-2" aria-hidden="true">
        <span class="text-primary font-bold">➜</span>
        <span class="terminal-caret inline-block h-5 w-2 bg-[oklch(0.5_0.01_100)]" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.terminal-caret {
  animation: blink 1.1s steps(1) infinite;
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .terminal-caret {
    animation: none;
  }
}
</style>
