<script setup lang="ts">
import { CAPABILITIES } from "@/content/replay";
import { vReveal } from "@/directives/reveal";
import CapabilityVisual from "./CapabilityVisual.vue";
</script>

<template>
  <div class="grid gap-4 md:grid-cols-3">
    <article
      v-for="(capability, index) in CAPABILITIES"
      :key="capability.id"
      v-reveal="index * 100"
      class="bg-card flex min-w-0 flex-col gap-5 rounded-2xl border p-5"
    >
      <CapabilityVisual :id="capability.id" />
      <div class="space-y-2 px-1 pb-1">
        <h3 class="flex items-start gap-2 text-xl font-semibold tracking-tight text-balance">
          <component
            :is="capability.icon"
            class="text-primary mt-1 size-5 shrink-0"
            aria-hidden="true"
          />
          <span
            >{{ capability.title }} <span class="accent">{{ capability.accent }}</span></span
          >
        </h3>
        <p class="text-muted-foreground text-sm leading-relaxed text-pretty">
          {{ capability.description }}
        </p>
      </div>
    </article>
  </div>
</template>
