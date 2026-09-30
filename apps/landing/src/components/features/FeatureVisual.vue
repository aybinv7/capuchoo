<script setup lang="ts">
import type { Feature } from "@/content/features";

const props = defineProps<{ visual: Feature["visual"] }>();
</script>

<template>
  <div
    aria-hidden="true"
    class="pointer-events-none absolute right-6 bottom-6 opacity-40 transition-all duration-500 group-hover:opacity-80"
  >
    <div v-if="props.visual === 'signature'" class="flex items-center gap-2 font-mono text-[10px]">
      <span class="border-ink-border rounded border bg-white/5 px-2 py-1 text-ink-muted"
        >sha256 9f2c…a41</span
      >
      <span class="text-primary">→</span>
      <span class="border-primary/40 text-primary rounded border bg-primary/10 px-2 py-1"
        >signed ✓</span
      >
    </div>
    <div v-else-if="props.visual === 'gate'" class="flex items-end gap-1.5">
      <span class="h-8 w-5 rounded-sm bg-white/10" />
      <span class="h-12 w-5 rounded-sm bg-white/20" />
      <span class="bg-primary/70 h-16 w-5 rounded-sm" />
    </div>
    <div
      v-else-if="props.visual === 'rollback'"
      class="border-ink-border relative size-20 rounded-full border-4 transition-transform duration-700 group-hover:-rotate-180"
    >
      <span
        class="bg-primary/70 absolute top-1/2 left-1/2 h-1 w-8 origin-left -translate-y-1/2 rounded"
      />
    </div>
    <div v-else-if="props.visual === 'canvas'" class="flex items-center gap-2">
      <span class="border-ink-border size-8 rounded-md border bg-white/5" />
      <span class="bg-ink-border h-px w-6" />
      <span class="border-primary/50 bg-primary/15 size-8 rounded-md border" />
      <span class="bg-ink-border h-px w-6" />
      <span class="border-ink-border size-8 rounded-md border bg-white/5" />
    </div>
    <div v-else-if="props.visual === 'flavours'" class="flex -space-x-3">
      <span class="border-ink size-10 rounded-full border-2 bg-[oklch(0.62_0.15_290)]" />
      <span class="border-ink size-10 rounded-full border-2 bg-[oklch(0.72_0.14_70)]" />
      <span class="border-ink size-10 rounded-full border-2 bg-[oklch(0.62_0.13_150)]" />
    </div>
    <div v-else class="space-y-1.5">
      <span class="block h-1.5 w-20 rounded bg-white/20" />
      <span class="block h-1.5 w-14 rounded bg-white/15" />
      <span class="bg-primary/60 block h-1.5 w-16 rounded" />
    </div>
  </div>
</template>
