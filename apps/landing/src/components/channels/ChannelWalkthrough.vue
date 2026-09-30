<script setup lang="ts">
import { ChevronLeft, ChevronRight, RotateCcw } from "@lucide/vue";
import { computed, ref } from "vue";
import { cn } from "@/lib/utils";
import { CHANNEL_STEPS } from "@/content/channels";
import ChannelNode from "./ChannelNode.vue";

const index = ref(0);
const step = computed(() => CHANNEL_STEPS[index.value]!);
const last = CHANNEL_STEPS.length - 1;

function go(next: number) {
  index.value = Math.min(last, Math.max(0, next));
}
</script>

<template>
  <div class="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
    <ol class="space-y-2" aria-label="Walkthrough steps">
      <li v-for="(entry, position) in CHANNEL_STEPS" :key="entry.title">
        <button
          type="button"
          :aria-current="position === index ? 'step' : undefined"
          :class="
            cn(
              'group flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
              position === index
                ? 'border-primary/40 bg-ink-raised'
                : 'border-transparent hover:border-ink-border hover:bg-ink-raised/50',
            )
          "
          @click="go(position)"
        >
          <span
            :class="
              cn(
                'mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border font-mono text-xs',
                position === index
                  ? 'border-primary bg-primary text-primary-foreground'
                  : position < index
                    ? 'border-primary/50 text-primary'
                    : 'border-ink-border text-ink-muted',
              )
            "
            >{{ position + 1 }}</span
          >
          <span
            :class="
              cn(
                'text-sm font-medium',
                position === index ? 'text-ink-foreground' : 'text-ink-muted',
              )
            "
            >{{ entry.title }}</span
          >
        </button>
      </li>
    </ol>

    <div class="border-ink-border rounded-2xl border bg-[oklch(0.19_0.003_100)] p-5 md:p-7">
      <div
        class="border-ink-border mb-6 flex items-center gap-2 overflow-x-auto rounded-lg border bg-black/20 px-3 py-2 font-mono text-[13px] whitespace-nowrap"
      >
        <span class="text-primary" aria-hidden="true">➜</span>
        <span class="text-ink-foreground">{{ step.command }}</span>
      </div>

      <div class="flex flex-col items-center">
        <div class="w-full max-w-xs">
          <ChannelNode name="prod" kind="release" :state="step.channels.prod" />
        </div>
        <div class="relative h-10 w-full" aria-hidden="true">
          <span class="border-ink-border absolute top-0 left-1/2 h-1/2 border-l border-dashed" />
          <span
            class="border-ink-border absolute top-1/2 right-1/4 left-1/4 border-t border-dashed"
          />
          <span class="border-ink-border absolute top-1/2 left-1/4 h-1/2 border-l border-dashed" />
          <span class="border-ink-border absolute top-1/2 right-1/4 h-1/2 border-r border-dashed" />
        </div>
        <div class="grid w-full grid-cols-2 gap-3">
          <ChannelNode name="prod-acme" kind="client" :state="step.channels['prod-acme']" />
          <ChannelNode name="prod-nova" kind="client" :state="step.channels['prod-nova']" />
        </div>
      </div>

      <p class="text-ink-muted mt-6 min-h-12 text-sm leading-relaxed" aria-live="polite">
        {{ step.note }}
      </p>

      <div class="mt-4 flex items-center gap-2">
        <button
          type="button"
          class="border-ink-border text-ink-muted hover:text-ink-foreground grid size-9 place-items-center rounded-full border transition-colors disabled:opacity-40"
          :disabled="index === 0"
          aria-label="Previous step"
          @click="go(index - 1)"
        >
          <ChevronLeft class="size-4" />
        </button>
        <button
          v-if="index < last"
          type="button"
          class="bg-primary text-primary-foreground flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition hover:brightness-110"
          @click="go(index + 1)"
        >
          Next
          <ChevronRight class="size-4" />
        </button>
        <button
          v-else
          type="button"
          class="border-ink-border text-ink-foreground flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition hover:bg-white/5"
          @click="go(0)"
        >
          <RotateCcw class="size-4" />
          Start over
        </button>
        <span class="text-ink-muted ml-auto font-mono text-xs tabular"
          >{{ index + 1 }} / {{ CHANNEL_STEPS.length }}</span
        >
      </div>
    </div>
  </div>
</template>
