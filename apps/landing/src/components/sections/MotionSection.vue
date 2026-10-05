<script setup lang="ts">
import BrowserFrame from "@/components/showcase/BrowserFrame.vue";
import LoopVideo from "@/components/showcase/LoopVideo.vue";
import SectionHeading from "@/components/ui/SectionHeading.vue";
import { CLIPS } from "@/content/screens";
import { vReveal } from "@/directives/reveal";

const PATHS: Record<(typeof CLIPS)[number]["id"], string> = {
  deliver: "release/channels",
  palette: "release/canvas",
};
</script>

<template>
  <section id="in-motion" class="bg-muted/40 border-y px-6 py-24">
    <div class="mx-auto max-w-6xl">
      <SectionHeading
        eyebrow="In motion"
        title="Two things your team"
        accent="will do every day."
        lead="Recorded in the real dashboard, on the demo organization."
      />
      <div class="grid gap-8 md:grid-cols-2">
        <figure
          v-for="(clip, index) in CLIPS"
          :key="clip.id"
          v-reveal="index * 120"
          class="min-w-0 space-y-4"
        >
          <BrowserFrame :path="PATHS[clip.id]">
            <LoopVideo :id="clip.id" :label="clip.title" />
          </BrowserFrame>
          <figcaption class="space-y-1.5 px-1">
            <p class="font-semibold">{{ clip.title }}</p>
            <p class="text-muted-foreground text-sm leading-relaxed">{{ clip.description }}</p>
          </figcaption>
        </figure>
      </div>
    </div>
  </section>
</template>
