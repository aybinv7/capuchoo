<script setup lang="ts">
import { ArrowUpRight, Check } from "@lucide/vue";
import SectionHeading from "@/components/ui/SectionHeading.vue";
import { SITE } from "@/config/site";
import { HOSTING } from "@/content/story";
import { vReveal } from "@/directives/reveal";
import { cn } from "@/lib/utils";
</script>

<template>
  <section id="self-host" class="bg-muted/40 border-y px-6 py-24">
    <div class="mx-auto max-w-6xl">
      <SectionHeading
        eyebrow="Self-host"
        title="Your server,"
        accent="your domain, your data."
        lead="Capuchoo is a server, a static dashboard and a PostgreSQL database. Run them wherever your other services run."
      />
      <div class="grid gap-4 md:grid-cols-3">
        <article
          v-for="(option, index) in HOSTING"
          :key="option.title"
          v-reveal="index * 120"
          :class="
            cn(
              'relative flex flex-col rounded-2xl border p-7',
              index === 0 ? 'border-primary/40 bg-card shadow-xl shadow-primary/10' : 'bg-card',
            )
          "
        >
          <span
            v-if="index === 0"
            class="bg-primary text-primary-foreground absolute -top-3 left-7 rounded-full px-3 py-0.5 text-[11px] font-semibold"
            >Recommended for production</span
          >
          <h3 class="mb-2 text-xl font-semibold tracking-tight">{{ option.title }}</h3>
          <p class="text-muted-foreground mb-6 text-sm leading-relaxed">{{ option.description }}</p>
          <ul class="mb-8 flex-1 space-y-2.5 text-sm">
            <li v-for="point in option.points" :key="point" class="flex gap-2">
              <Check class="text-primary mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{{ point }}</span>
            </li>
          </ul>
          <a
            :href="SITE[option.link]"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline"
          >
            {{
              option.link === "selfHosting" ? "Read the self-hosting guide" : "Browse the source"
            }}
            <ArrowUpRight class="size-4" />
          </a>
        </article>
      </div>
    </div>
  </section>
</template>
