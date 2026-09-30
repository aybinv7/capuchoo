<script setup lang="ts">
import SectionHeading from "@/components/ui/SectionHeading.vue";
import { INTEGRATIONS } from "@/content/story";
import { vReveal } from "@/directives/reveal";
</script>

<template>
  <section id="integrations" class="px-6 py-24">
    <div class="mx-auto max-w-6xl">
      <SectionHeading
        eyebrow="Works with"
        title="Fits the stack"
        accent="you already run."
        lead="No new infrastructure to learn: PostgreSQL, an object store if you want one, and Docker."
      />
      <ul class="grid grid-cols-2 gap-3 md:grid-cols-4">
        <li
          v-for="(integration, index) in INTEGRATIONS"
          :key="integration.name"
          v-reveal="(index % 4) * 80"
          class="group border-ink-border bg-ink text-ink-foreground relative flex items-center gap-3 overflow-hidden rounded-2xl border px-4 py-4"
        >
          <div
            aria-hidden="true"
            class="from-ink-raised to-ink absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          />
          <component :is="integration.icon" class="relative size-5 shrink-0" aria-hidden="true" />
          <div class="relative min-w-0">
            <p class="truncate text-sm font-medium">{{ integration.name }}</p>
            <p class="text-ink-muted truncate text-xs">{{ integration.detail }}</p>
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>
