<script setup lang="ts">
import { ArrowRight } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import HeroShowcase from "@/components/showcase/HeroShowcase.vue";
import GridBackdrop from "@/components/ui/GridBackdrop.vue";
import { vReveal } from "@/directives/reveal";
import { SITE } from "@/config/site";
</script>

<template>
  <section id="top" class="relative overflow-hidden px-6 pt-28 pb-16 md:pt-32 md:pb-24">
    <GridBackdrop />
    <div
      aria-hidden="true"
      class="bg-primary/15 pointer-events-none absolute top-24 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full blur-3xl"
    />

    <div class="relative mx-auto flex max-w-5xl flex-col items-center text-center">
      <a
        v-reveal
        :href="SITE.repository"
        target="_blank"
        rel="noopener noreferrer"
        class="border-primary/20 bg-card/80 hover:border-primary/40 mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 shadow-sm backdrop-blur-sm transition-colors"
      >
        <span class="relative flex size-2">
          <span
            class="bg-primary absolute inline-flex size-full animate-ping rounded-full opacity-60 motion-reduce:animate-none"
          />
          <span class="bg-primary relative inline-flex size-2 rounded-full" />
        </span>
        <span class="text-primary text-xs font-semibold tracking-wide uppercase"
          >Open source · Self-hosted</span
        >
      </a>

      <h1
        v-reveal="100"
        class="mb-6 max-w-5xl text-5xl leading-[0.95] font-semibold tracking-tight text-balance md:text-6xl lg:text-7xl"
      >
        Ship Capacitor updates
        <span class="accent text-shiny block pr-2 pb-2">without the store wait.</span>
      </h1>

      <p
        v-reveal="200"
        class="text-muted-foreground mx-auto mb-8 max-w-2xl text-lg leading-relaxed text-pretty"
      >
        Web bundles and native APKs, signed by your CLI, delivered through channels you control, and
        verified on every device before they run. One build for every customer, on your own server.
      </p>

      <div v-reveal="300" class="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
        <Button
          as="a"
          :href="SITE.dashboardUrl"
          size="lg"
          class="group w-full rounded-full px-8 shadow-xl shadow-primary/20 sm:w-auto"
        >
          Open the dashboard
          <ArrowRight class="transition-transform group-hover:translate-x-1" />
        </Button>
        <Button
          as="a"
          :href="SITE.selfHosting"
          target="_blank"
          rel="noopener noreferrer"
          variant="outline"
          size="lg"
          class="bg-background/60 w-full rounded-full px-8 sm:w-auto"
        >
          Self-host it
        </Button>
      </div>
    </div>
    <HeroShowcase />
  </section>
</template>
