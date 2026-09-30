<script setup lang="ts">
import type { Feature } from "@/content/features";
import FeatureVisual from "./FeatureVisual.vue";

const props = defineProps<{ feature: Feature }>();
</script>

<template>
  <article
    class="group border-ink-border bg-ink text-ink-foreground relative flex min-h-64 flex-col overflow-hidden rounded-2xl border p-8 transition-shadow duration-300 hover:shadow-xl"
  >
    <div class="from-ink-raised to-ink absolute inset-0 bg-gradient-to-br" aria-hidden="true" />
    <div
      aria-hidden="true"
      class="bg-primary/30 pointer-events-none absolute -top-12 left-0 h-40 w-full -translate-x-1/3 rounded-full opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-100"
    />
    <div
      aria-hidden="true"
      class="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
    />
    <div class="relative z-10 flex flex-1 flex-col">
      <div
        class="border-ink-border mb-6 grid size-12 place-items-center rounded-2xl border bg-white/5 shadow-inner"
      >
        <component :is="props.feature.icon" class="size-6" />
      </div>
      <h3 class="mb-2 text-2xl font-semibold">
        {{ props.feature.title }} <span class="accent">{{ props.feature.accent }}</span>
      </h3>
      <p class="text-ink-muted max-w-md text-sm leading-relaxed">{{ props.feature.description }}</p>
    </div>
    <FeatureVisual :visual="props.feature.visual" />
  </article>
</template>
