<script setup lang="ts">
import FeatureCard from "@/components/features/FeatureCard.vue";
import SectionHeading from "@/components/ui/SectionHeading.vue";
import { FEATURES } from "@/content/features";
import { vReveal } from "@/directives/reveal";
</script>

<template>
  <section id="features" class="px-6 py-24">
    <div class="mx-auto max-w-7xl">
      <SectionHeading
        eyebrow="Core capabilities"
        title="Built so a bad release"
        accent="cannot sneak out."
        lead="The server enforces every guard below, whether a change comes from the CLI, CI or the dashboard. The device checks the signature again before it runs anything."
      />
      <div class="grid grid-cols-1 gap-3 md:grid-cols-6 lg:grid-cols-12">
        <div
          v-for="(feature, index) in FEATURES"
          :key="feature.title"
          v-reveal="(index % 3) * 100"
          :class="
            feature.span === 'wide' ? 'md:col-span-6 lg:col-span-8' : 'md:col-span-6 lg:col-span-4'
          "
          class="flex"
        >
          <FeatureCard :feature="feature" class="w-full" />
        </div>
      </div>
    </div>
  </section>
</template>
