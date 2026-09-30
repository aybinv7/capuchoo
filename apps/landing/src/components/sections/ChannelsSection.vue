<script setup lang="ts">
import ChannelWalkthrough from "@/components/channels/ChannelWalkthrough.vue";
import SectionHeading from "@/components/ui/SectionHeading.vue";
import { vReveal } from "@/directives/reveal";
</script>

<template>
  <section id="channels" class="bg-ink text-ink-foreground relative overflow-hidden px-6 py-24">
    <div
      aria-hidden="true"
      class="bg-primary/15 pointer-events-none absolute -top-24 right-0 size-[32rem] rounded-full blur-[120px]"
    />
    <div class="relative mx-auto max-w-6xl">
      <SectionHeading
        tone="ink"
        eyebrow="Client channels"
        title="One APK. Every customer"
        accent="at their own pace."
        lead="Give one customer a fix without disturbing the others. The next customer to update gets that fix and theirs together, in a single update. Step through it:"
      />
      <div v-reveal>
        <ChannelWalkthrough />
      </div>
    </div>
  </section>
</template>
