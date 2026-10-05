<script setup lang="ts">
import { Check, Minus } from "@lucide/vue";
import { TRACKS } from "@/content/replay";
import { vReveal } from "@/directives/reveal";
</script>

<template>
  <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <li
      v-for="(track, index) in TRACKS"
      :key="track.name"
      v-reveal="index * 80"
      class="bg-card/60 min-w-0 rounded-xl border p-4"
    >
      <p class="mb-3 flex items-center gap-2 text-sm font-semibold">
        <component :is="track.icon" class="text-primary size-4" aria-hidden="true" />
        {{ track.name }}
      </p>
      <p class="flex gap-2 text-sm leading-snug">
        <Check class="text-success mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>{{ track.kept }}</span>
      </p>
      <p class="text-muted-foreground mt-1.5 flex gap-2 text-sm leading-snug">
        <Minus class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span><span class="sr-only">Never: </span>{{ track.never }}</span>
      </p>
    </li>
  </ul>
</template>
