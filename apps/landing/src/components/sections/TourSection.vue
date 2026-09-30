<script setup lang="ts">
import { useIntervalFn, useIntersectionObserver } from "@vueuse/core";
import { computed, ref, useTemplateRef, watch } from "vue";
import BrowserFrame from "@/components/showcase/BrowserFrame.vue";
import ThemedShot from "@/components/showcase/ThemedShot.vue";
import SectionHeading from "@/components/ui/SectionHeading.vue";
import { useReducedMotion } from "@/composables/useReducedMotion";
import { TOUR } from "@/content/screens";
import { vReveal } from "@/directives/reveal";
import { cn } from "@/lib/utils";

const ADVANCE_MS = 6500;

const activeId = ref(TOUR[0]!.id);
const active = computed(() => TOUR.find((stop) => stop.id === activeId.value) ?? TOUR[0]!);
const touched = ref(false);
const inView = ref(false);
const reduced = useReducedMotion();
const root = useTemplateRef<HTMLElement>("root");
const tabs = useTemplateRef<HTMLButtonElement[]>("tabs");

useIntersectionObserver(
  root,
  ([entry]) => {
    inView.value = Boolean(entry?.isIntersecting);
  },
  { threshold: 0.4 },
);

const { pause, resume } = useIntervalFn(
  () => {
    const index = TOUR.findIndex((stop) => stop.id === activeId.value);
    activeId.value = TOUR[(index + 1) % TOUR.length]!.id;
  },
  ADVANCE_MS,
  { immediate: false },
);

watch(
  [inView, touched, reduced],
  ([visible, stopped, reduce]) => {
    if (visible && !stopped && !reduce) resume();
    else pause();
  },
  { immediate: true },
);

function choose(id: (typeof TOUR)[number]["id"]) {
  touched.value = true;
  activeId.value = id;
}

function onKey(event: KeyboardEvent, index: number) {
  const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
  if (!step) return;
  event.preventDefault();
  const next = (index + step + TOUR.length) % TOUR.length;
  choose(TOUR[next]!.id);
  tabs.value?.[next]?.focus();
}
</script>

<template>
  <section id="tour" ref="root" class="px-6 py-24">
    <div class="mx-auto max-w-6xl">
      <SectionHeading
        eyebrow="Product tour"
        title="The dashboard,"
        accent="as your team will use it."
        lead="Screenshots of the real dashboard on a fictional organization: a field-sales app with three customers and a fleet of 140 tablets."
      />

      <div
        v-reveal
        role="tablist"
        aria-label="Dashboard screens"
        class="mb-8 flex flex-wrap justify-center gap-1.5"
      >
        <button
          v-for="(stop, index) in TOUR"
          :id="`tour-tab-${stop.id}`"
          ref="tabs"
          :key="stop.id"
          type="button"
          role="tab"
          :aria-selected="stop.id === activeId"
          aria-controls="tour-panel"
          :tabindex="stop.id === activeId ? 0 : -1"
          :class="
            cn(
              'relative overflow-hidden rounded-full border px-4 py-1.5 text-sm font-medium transition-colors duration-300',
              stop.id === activeId
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground border-transparent',
            )
          "
          @click="choose(stop.id)"
          @keydown="onKey($event, index)"
        >
          {{ stop.label }}
          <span
            v-if="stop.id === activeId && !touched && !reduced && inView"
            :key="`progress-${stop.id}`"
            aria-hidden="true"
            class="tour-progress bg-primary absolute bottom-0 left-0 h-0.5"
            :style="{ animationDuration: `${ADVANCE_MS}ms` }"
          />
        </button>
      </div>

      <div
        id="tour-panel"
        v-reveal="100"
        role="tabpanel"
        :aria-labelledby="`tour-tab-${activeId}`"
        class="grid items-center gap-8 lg:grid-cols-[1fr_2.4fr]"
      >
        <Transition
          mode="out-in"
          enter-active-class="transition duration-500 ease-out"
          enter-from-class="opacity-0 translate-y-2"
          leave-active-class="transition duration-200 ease-in"
          leave-to-class="opacity-0"
        >
          <div :key="active.id" class="min-w-0 space-y-3 lg:pr-4">
            <h3 class="text-2xl font-semibold tracking-tight text-balance">{{ active.title }}</h3>
            <p class="text-muted-foreground leading-relaxed text-pretty">
              {{ active.description }}
            </p>
          </div>
        </Transition>
        <div class="relative min-w-0">
          <div
            aria-hidden="true"
            class="bg-primary/15 pointer-events-none absolute inset-x-8 -bottom-8 h-1/2 rounded-full blur-3xl"
          />
          <BrowserFrame :path="active.path" class="relative">
            <div class="relative aspect-[16/10]">
              <Transition
                enter-active-class="transition duration-500 ease-out"
                enter-from-class="opacity-0 scale-[1.01]"
                leave-active-class="absolute inset-0 transition duration-300 ease-in"
                leave-to-class="opacity-0"
              >
                <ThemedShot
                  :id="active.id"
                  :key="active.id"
                  :alt="active.title"
                  sizes="(min-width: 1200px) 820px, 100vw"
                  class="absolute inset-0"
                />
              </Transition>
            </div>
          </BrowserFrame>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.tour-progress {
  animation-name: tour-fill;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}

@keyframes tour-fill {
  from {
    width: 0;
  }
  to {
    width: 100%;
  }
}
</style>
