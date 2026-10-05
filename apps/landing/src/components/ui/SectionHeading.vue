<script setup lang="ts">
import { cn } from "@/lib/utils";
import { vReveal } from "@/directives/reveal";
import AnimatedUnderline from "./AnimatedUnderline.vue";

const props = withDefaults(
  defineProps<{
    eyebrow: string;
    title?: string;
    accent: string;
    lead?: string;
    align?: "center" | "left";
    tone?: "default" | "ink";
  }>(),
  { title: undefined, lead: undefined, align: "center", tone: "default" },
);
</script>

<template>
  <header
    v-reveal
    :class="
      cn(
        'mb-14 flex flex-col gap-4',
        props.align === 'center' ? 'items-center text-center' : 'items-start',
      )
    "
  >
    <span
      :class="
        cn(
          'inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-wide uppercase',
          props.tone === 'ink'
            ? 'border-ink-border bg-ink-raised text-ink-muted'
            : 'border-primary/20 bg-primary/5 text-primary',
        )
      "
      >{{ props.eyebrow }}</span
    >
    <h2
      :class="
        cn(
          'max-w-3xl text-3xl font-semibold tracking-tight text-balance md:text-5xl',
          props.tone === 'ink' && 'text-ink-foreground',
        )
      "
    >
      <template v-if="props.title">{{ `${props.title} ` }}</template>
      <span class="accent relative inline-block">
        {{ props.accent }}
        <AnimatedUnderline />
      </span>
    </h2>
    <p
      v-if="props.lead"
      :class="
        cn(
          'max-w-2xl text-base leading-relaxed text-pretty md:text-lg',
          props.tone === 'ink' ? 'text-ink-muted' : 'text-muted-foreground',
        )
      "
    >
      {{ props.lead }}
    </p>
  </header>
</template>
