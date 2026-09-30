<script setup lang="ts">
import { Plus } from "@lucide/vue";
import SectionHeading from "@/components/ui/SectionHeading.vue";
import { FAQ } from "@/content/story";
import { vReveal } from "@/directives/reveal";
</script>

<template>
  <section id="faq" class="px-6 py-24">
    <div class="mx-auto max-w-3xl">
      <SectionHeading eyebrow="Questions" title="Before you" accent="ship the first one." />
      <div v-reveal class="divide-y rounded-2xl border">
        <details v-for="entry in FAQ" :key="entry.question" class="group px-6 py-5">
          <summary
            class="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-medium [&::-webkit-details-marker]:hidden"
          >
            {{ entry.question }}
            <Plus
              class="text-muted-foreground size-4 shrink-0 transition-transform duration-200 group-open:rotate-45"
              aria-hidden="true"
            />
          </summary>
          <p class="text-muted-foreground mt-3 text-sm leading-relaxed">{{ entry.answer }}</p>
        </details>
      </div>
    </div>
  </section>
</template>
