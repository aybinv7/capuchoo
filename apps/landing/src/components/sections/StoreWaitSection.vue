<script setup lang="ts">
import { ChevronRight } from "@lucide/vue";
import SectionHeading from "@/components/ui/SectionHeading.vue";
import { TIMELINES } from "@/content/story";
import { vReveal } from "@/directives/reveal";
import { cn } from "@/lib/utils";
</script>

<template>
  <section class="px-6 py-24">
    <div class="mx-auto max-w-6xl">
      <SectionHeading
        eyebrow="The problem"
        title="A one-line fix should not"
        accent="wait a week."
        lead="Most of a Capacitor app is web code. When it breaks, you can ship the fix to the devices that need it, instead of waiting for review and for every user to update."
      />
      <div class="grid gap-4 md:grid-cols-2">
        <article
          v-for="(timeline, index) in TIMELINES"
          :key="timeline.label"
          v-reveal="index * 120"
          :class="
            cn(
              'relative overflow-hidden rounded-2xl border p-7',
              timeline.tone === 'fast'
                ? 'border-ink-border bg-ink text-ink-foreground'
                : 'bg-card text-card-foreground',
            )
          "
        >
          <p
            :class="
              cn(
                'mb-5 text-xs font-semibold tracking-wide uppercase',
                timeline.tone === 'fast' ? 'text-primary' : 'text-muted-foreground',
              )
            "
          >
            {{ timeline.label }}
          </p>
          <ol class="mb-8 flex flex-wrap items-center gap-1.5">
            <template v-for="(step, stepIndex) in timeline.steps" :key="step">
              <li
                :class="
                  cn(
                    'rounded-md border px-2.5 py-1 text-sm',
                    timeline.tone === 'fast'
                      ? 'border-ink-border bg-ink-raised font-mono text-[13px]'
                      : 'bg-muted/60',
                  )
                "
              >
                {{ step }}
              </li>
              <ChevronRight
                v-if="stepIndex < timeline.steps.length - 1"
                class="size-3.5 opacity-40"
                aria-hidden="true"
              />
            </template>
          </ol>
          <p
            :class="
              cn(
                'text-2xl font-semibold tracking-tight md:text-3xl',
                timeline.tone === 'fast' && 'text-ink-foreground',
              )
            "
          >
            <span class="accent">{{ timeline.outcome }}</span>
          </p>
          <div
            v-if="timeline.tone === 'fast'"
            aria-hidden="true"
            class="bg-primary/25 pointer-events-none absolute -right-16 -bottom-20 size-64 rounded-full blur-3xl"
          />
        </article>
      </div>
      <p v-reveal class="text-muted-foreground mt-6 text-center text-sm">
        Native changes still need a new build: Capuchoo delivers the APK too, behind the same
        channels.
      </p>
    </div>
  </section>
</template>
