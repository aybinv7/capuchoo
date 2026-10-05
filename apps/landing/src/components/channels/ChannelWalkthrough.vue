<script setup lang="ts">
import { ChevronLeft, ChevronRight, RotateCcw } from "@lucide/vue";
import { useMediaQuery } from "@vueuse/core";
import { computed, ref, useTemplateRef } from "vue";
import { useReducedMotion } from "@/composables/useReducedMotion";
import { useScrollProgress } from "@/composables/useScrollProgress";
import { CHANNEL_STEPS } from "@/content/channels";
import { cn } from "@/lib/utils";
import ChannelNode from "./ChannelNode.vue";

const STEP_HEIGHT_VH = 70;
const last = CHANNEL_STEPS.length - 1;

const track = useTemplateRef<HTMLElement>("track");
const reduced = useReducedMotion();
const wide = useMediaQuery("(min-width: 1024px)");
const scrollDriven = computed(() => wide.value && !reduced.value);
const { progress } = useScrollProgress(track, "through");

const manual = ref(0);
const position = computed(() =>
  scrollDriven.value ? progress.value * CHANNEL_STEPS.length : manual.value,
);
const index = computed(() => Math.min(last, Math.max(0, Math.floor(position.value))));
const within = computed(() =>
  scrollDriven.value ? Math.min(1, Math.max(0, position.value - index.value)) : 1,
);
const step = computed(() => CHANNEL_STEPS[index.value]!);

/** In scroll mode a step is a place on the page, so choosing one scrolls there. */
function go(next: number) {
  const target = Math.min(last, Math.max(0, next));
  if (!scrollDriven.value || !track.value) {
    manual.value = target;
    return;
  }
  const rect = track.value.getBoundingClientRect();
  const travel = rect.height - window.innerHeight;
  const top = window.scrollY + rect.top + ((target + 0.5) / CHANNEL_STEPS.length) * travel;
  window.scrollTo({ top, behavior: "smooth" });
}
</script>

<template>
  <div
    ref="track"
    class="relative"
    :style="
      scrollDriven ? { height: `${CHANNEL_STEPS.length * STEP_HEIGHT_VH + 30}vh` } : undefined
    "
  >
    <div :class="scrollDriven && 'sticky top-0 flex h-svh items-center'">
      <div class="grid w-full gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <ol class="space-y-2" aria-label="Walkthrough steps">
          <li v-for="(entry, stepIndex) in CHANNEL_STEPS" :key="entry.title">
            <button
              type="button"
              :aria-current="stepIndex === index ? 'step' : undefined"
              :class="
                cn(
                  'relative flex w-full items-start gap-3 overflow-hidden rounded-xl border px-4 py-3 text-left transition-colors duration-300',
                  stepIndex === index
                    ? 'border-primary/40 bg-ink-raised'
                    : 'hover:border-ink-border hover:bg-ink-raised/50 border-transparent',
                )
              "
              @click="go(stepIndex)"
            >
              <span
                :class="
                  cn(
                    'mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border font-mono text-xs transition-colors duration-300',
                    stepIndex === index
                      ? 'border-primary bg-primary text-primary-foreground'
                      : stepIndex < index
                        ? 'border-primary/50 text-primary'
                        : 'border-ink-border text-ink-muted',
                  )
                "
                >{{ stepIndex + 1 }}</span
              >
              <span
                :class="
                  cn(
                    'text-sm font-medium transition-colors duration-300',
                    stepIndex === index ? 'text-ink-foreground' : 'text-ink-muted',
                  )
                "
                >{{ entry.title }}</span
              >
              <span
                v-if="scrollDriven && stepIndex === index"
                aria-hidden="true"
                class="bg-primary absolute bottom-0 left-0 h-0.5 transition-[width] duration-150 ease-linear"
                :style="{ width: `${within * 100}%` }"
              />
            </button>
          </li>
        </ol>

        <div class="border-ink-border rounded-2xl border bg-[oklch(0.19_0.003_100)] p-5 md:p-7">
          <div
            class="border-ink-border mb-6 flex items-center gap-2 overflow-x-auto rounded-lg border bg-black/20 px-3 py-2 font-mono text-[13px] whitespace-nowrap"
          >
            <span class="text-primary" aria-hidden="true">➜</span>
            <Transition
              mode="out-in"
              enter-active-class="transition duration-300"
              enter-from-class="opacity-0 translate-x-2"
              leave-active-class="transition duration-150"
              leave-to-class="opacity-0"
            >
              <span :key="step.command + index" class="text-ink-foreground">{{
                step.command
              }}</span>
            </Transition>
          </div>

          <div class="flex flex-col items-center">
            <div class="w-full max-w-xs">
              <ChannelNode name="prod" kind="release" :state="step.channels.prod" />
            </div>
            <div class="relative h-10 w-full" aria-hidden="true">
              <span
                class="border-ink-border absolute top-0 left-1/2 h-1/2 border-l border-dashed"
              />
              <span
                class="border-ink-border absolute top-1/2 right-1/4 left-1/4 border-t border-dashed"
              />
              <span
                class="border-ink-border absolute top-1/2 left-1/4 h-1/2 border-l border-dashed"
              />
              <span
                class="border-ink-border absolute top-1/2 right-1/4 h-1/2 border-r border-dashed"
              />
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
          <p v-if="scrollDriven" class="text-ink-muted/70 mt-3 text-[11px]">
            Scroll to step through, or pick a step.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
