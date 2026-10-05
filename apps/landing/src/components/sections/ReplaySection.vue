<script setup lang="ts">
import { ArrowUpRight } from "@lucide/vue";
import ModeLadder from "@/components/replay/ModeLadder.vue";
import ReplayCapabilities from "@/components/replay/ReplayCapabilities.vue";
import ReplayShowcase from "@/components/replay/ReplayShowcase.vue";
import TrackStrip from "@/components/replay/TrackStrip.vue";
import SectionHeading from "@/components/ui/SectionHeading.vue";
import { SITE } from "@/config/site";
import { vReveal } from "@/directives/reveal";
</script>

<template>
  <section id="replay" class="relative overflow-x-clip px-6 py-24 md:py-32">
    <div
      aria-hidden="true"
      class="from-primary/[0.04] pointer-events-none absolute inset-x-0 top-0 h-96 bg-gradient-to-b to-transparent"
    />
    <div class="relative mx-auto max-w-6xl">
      <SectionHeading
        eyebrow="Session replay · new"
        title="When it breaks on a tablet in Oran,"
        accent="watch it happen."
        lead="The recorder keeps the last minutes on the phone. An error, a shake or a report sends them up: the screen, its console and network, and every database write, on one timeline you can scrub."
      />

      <ReplayShowcase />

      <div class="mt-20">
        <TrackStrip />
      </div>

      <div class="mt-24">
        <div v-reveal class="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div class="max-w-2xl space-y-2">
            <h3 class="text-2xl font-semibold tracking-tight text-balance md:text-3xl">
              Record as much as the moment
              <span class="accent">needs, and no more.</span>
            </h3>
            <p class="text-muted-foreground leading-relaxed text-pretty">
              A rule per app, channel or device decides, and the dashboard can raise one tablet to
              live while you watch it. On a mid-range phone a recorded minute costs between 2 and 80
              KB.
            </p>
          </div>
        </div>
        <ModeLadder />
      </div>

      <div class="mt-24">
        <ReplayCapabilities />
      </div>

      <p v-reveal class="text-muted-foreground mt-12 text-center text-sm">
        One package in the app, its pipeline in a worker so the UI never waits:
        <a
          :href="SITE.npmRecorder"
          target="_blank"
          rel="noopener noreferrer"
          class="text-foreground inline-flex items-center gap-0.5 font-mono underline-offset-4 hover:underline"
          >@capuchoo/recorder<ArrowUpRight class="size-3.5"
        /></a>
      </p>
    </div>
  </section>
</template>
