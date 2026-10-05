<script setup lang="ts">
import CopyCommand from "@/components/ui/CopyCommand.vue";
import SectionHeading from "@/components/ui/SectionHeading.vue";
import { STEPS } from "@/content/story";
import { vReveal } from "@/directives/reveal";
</script>

<template>
  <section id="how-it-works" class="px-6 py-24">
    <div class="mx-auto max-w-6xl">
      <SectionHeading
        eyebrow="How it works"
        title="Three steps,"
        accent="then just a pointer."
        lead="Uploading and delivering are separate. A release only reaches devices when a channel points at it, so nothing ships by accident."
      />
      <ol class="grid gap-4 md:grid-cols-3">
        <li
          v-for="(step, index) in STEPS"
          :key="step.title"
          v-reveal="index * 120"
          class="bg-card relative flex min-w-0 flex-col gap-4 rounded-2xl border p-7"
        >
          <span
            class="border-primary/30 bg-primary/10 text-primary grid size-9 place-items-center rounded-full border font-mono text-sm font-semibold"
            >{{ index + 1 }}</span
          >
          <h3 class="text-xl font-semibold tracking-tight">{{ step.title }}</h3>
          <p class="text-muted-foreground flex-1 text-sm leading-relaxed">{{ step.description }}</p>
          <CopyCommand v-if="step.code" :command="step.code" />
        </li>
      </ol>
    </div>
  </section>
</template>
