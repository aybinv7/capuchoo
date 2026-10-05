<script setup lang="ts">
import { MODES } from "@/content/replay";
import { vReveal } from "@/directives/reveal";
import { cn } from "@/lib/utils";

const BARS = [0, 1, 2, 3] as const;
/** How many of the four bars each mode lights: the level of what leaves the phone. */
const LIT: Record<(typeof MODES)[number]["id"], number> = {
  off: 0,
  buffer: 2,
  session: 3,
  live: 4,
};
</script>

<template>
  <div v-reveal class="grid gap-px overflow-hidden rounded-2xl border bg-border md:grid-cols-4">
    <article v-for="mode in MODES" :key="mode.id" class="bg-card flex min-w-0 flex-col gap-4 p-6">
      <div class="flex items-end gap-1" aria-hidden="true">
        <span
          v-for="bar in BARS"
          :key="bar"
          :class="
            cn(
              'w-2.5 rounded-sm transition-colors',
              bar < LIT[mode.id] ? 'bg-primary' : 'bg-muted',
              mode.id === 'live' && bar === 3 && 'animate-pulse motion-reduce:animate-none',
            )
          "
          :style="{ height: `${10 + bar * 7}px` }"
        />
      </div>
      <div class="space-y-1">
        <h3 class="text-lg font-semibold">{{ mode.label }}</h3>
        <p class="text-primary font-mono text-sm font-medium">{{ mode.figure }}</p>
      </div>
      <div class="space-y-1.5">
        <p class="text-sm font-medium">{{ mode.claim }}</p>
        <p class="text-muted-foreground text-sm leading-relaxed text-pretty">{{ mode.detail }}</p>
      </div>
    </article>
  </div>
</template>
