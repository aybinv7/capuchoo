<template>
  <F7Page
    class="welcome-page"
    :page-content="false"
    @page:afterin="current = true"
    @page:beforeout="current = false"
  >
    <div
      class="relative flex h-full flex-col pt-[calc(var(--f7-safe-area-top)+8px)] pb-[var(--f7-safe-area-bottom)]"
    >
      <header class="relative z-10 flex h-12 shrink-0 items-center px-5">
        <span class="flex items-center gap-2 text-sm font-bold tracking-tight text-foreground">
          <MaterialShape
            shape="cookie9"
            class="grid size-7 place-items-center bg-primary text-primary-foreground"
          >
            <F7Icon md="material:rocket_launch" size="16" />
          </MaterialShape>
          Capuchoo
        </span>
        <button
          v-if="!isLast"
          type="button"
          class="ms-auto h-10 w-auto! rounded-full px-4 text-sm font-semibold text-muted-foreground active:bg-muted"
          @click="finish"
        >
          {{ t("welcome.skip") }}
        </button>
      </header>

      <div
        ref="track"
        class="welcome-track flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain"
        role="region"
        :aria-roledescription="t('welcome.carousel')"
        @scroll.passive="onScroll"
      >
        <section
          v-for="(slide, position) in SLIDES"
          :key="slide.id"
          class="welcome-slide flex w-full shrink-0 snap-center snap-always flex-col items-center justify-center gap-8 px-6 pb-2"
          :aria-label="t('welcome.position', { n: position + 1, total: SLIDES.length })"
          :aria-hidden="position !== index"
        >
          <div class="welcome-stage parallax-deep">
            <component :is="slide.scene" :active="position === index && current" />
          </div>
          <div class="parallax-soft flex w-full max-w-md flex-col gap-2.5">
            <span
              class="w-fit rounded-full bg-secondary px-3 py-1 text-xs font-semibold tracking-wide text-secondary-foreground uppercase"
            >
              {{ t(`welcome.${slide.id}.kicker`) }}
            </span>
            <h1 class="m-0 text-[2rem] leading-[1.08] font-bold tracking-tight text-foreground">
              {{ t(`welcome.${slide.id}.title`) }}
            </h1>
            <p class="m-0 text-base leading-relaxed text-muted-foreground">
              {{ t(`welcome.${slide.id}.body`) }}
            </p>
          </div>
        </section>
      </div>

      <footer class="relative z-10 flex shrink-0 items-center justify-between gap-4 px-6 pt-2 pb-6">
        <div class="flex items-center gap-2" aria-hidden="true">
          <span
            v-for="(slide, position) in SLIDES"
            :key="slide.id"
            class="h-2 rounded-full transition-[width,background-color] duration-300"
            :class="position === index ? 'w-7 bg-primary' : 'w-2 bg-muted-foreground/30'"
          />
        </div>
        <button
          type="button"
          class="welcome-next flex h-14 items-center justify-center gap-2 overflow-hidden rounded-2xl bg-primary-container font-semibold text-primary-container-foreground shadow-float active:scale-95"
          :class="isLast ? 'w-52! px-5' : 'w-14!'"
          :aria-label="isLast ? t('welcome.start') : t('welcome.next')"
          @click="next"
        >
          <span v-if="isLast" class="whitespace-nowrap">{{ t("welcome.start") }}</span>
          <F7Icon md="material:arrow_forward" size="24" class="shrink-0" />
        </button>
      </footer>
    </div>
  </F7Page>
</template>

<script setup lang="ts">
import type { Component } from "vue";
import type { Router } from "framework7/types";
import MaterialShape from "@/shared/components/shape/MaterialShape.vue";
import { finishOnboarding } from "@/shared/session/onboarding";
import { tick } from "@/shared/utils/native/haptics";
import SceneInstall from "../components/scenes/SceneInstall.vue";
import SceneLanes from "../components/scenes/SceneLanes.vue";
import SceneNotify from "../components/scenes/SceneNotify.vue";
import SceneRoles from "../components/scenes/SceneRoles.vue";

const SLIDES: ReadonlyArray<{ id: string; scene: Component }> = [
  { id: "lanes", scene: SceneLanes },
  { id: "install", scene: SceneInstall },
  { id: "notify", scene: SceneNotify },
  { id: "roles", scene: SceneRoles },
];

/**
 * What Capuchoo does, in four small live scenes rather than paragraphs: where each release
 * stands, the build on this phone, the news as it happens, and what a role allows. Swiping is
 * the platform's own scroll snapping, and scene and words drift at two depths on scroll-driven
 * animations.
 */
const props = defineProps<{ f7router: Router.Router }>();

const { t } = useI18n();
const current = ref(true);
const track = useTemplateRef<HTMLElement>("track");
const index = ref(0);
const isLast = computed(() => index.value === SLIDES.length - 1);

let frame = 0;
function onScroll(): void {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    const element = track.value;
    if (!element?.clientWidth) return;
    const next = Math.min(
      SLIDES.length - 1,
      Math.round(Math.abs(element.scrollLeft) / element.clientWidth),
    );
    if (next !== index.value) tick();
    index.value = next;
  });
}

onBeforeUnmount(() => cancelAnimationFrame(frame));

function goTo(target: number): void {
  const element = track.value;
  if (!element || target < 0 || target >= SLIDES.length) return;
  element.scrollTo({ left: target * element.clientWidth, behavior: "smooth" });
}

function finish(): void {
  finishOnboarding();
  props.f7router.navigate("/sign-in/", { clearPreviousHistory: true, transition: "cap-end" });
}

function next(): void {
  if (isLast.value) finish();
  else goTo(index.value + 1);
}
</script>

<style scoped>
.welcome-page {
  background: var(--background);
}

.welcome-track {
  scrollbar-width: none;
}

.welcome-stage {
  width: min(80vw, 40vh, 360px);
}

.welcome-next {
  transition:
    width 420ms cubic-bezier(0.34, 1.3, 0.64, 1),
    scale 150ms ease;
}

/*
 * Each slide is a view timeline across the track; its scene and its words ride that timeline at
 * two depths, so a swipe reads as moving through space rather than sliding a page.
 */
@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {
    .welcome-slide {
      view-timeline: --welcome-slide inline;
    }

    .parallax-deep,
    .parallax-soft {
      animation-timing-function: linear;
      animation-fill-mode: both;
      animation-timeline: --welcome-slide;
      animation-range: cover;
    }

    .parallax-deep {
      animation-name: parallax-deep;
    }

    .parallax-soft {
      animation-name: parallax-soft;
    }
  }
}

@keyframes parallax-deep {
  0% {
    translate: 38% 0;
    scale: 0.86;
    opacity: 0.2;
  }
  50% {
    translate: 0 0;
    scale: 1;
    opacity: 1;
  }
  100% {
    translate: -38% 0;
    scale: 0.86;
    opacity: 0.2;
  }
}

@keyframes parallax-soft {
  0% {
    translate: 14% 0;
    opacity: 0;
  }
  50% {
    translate: 0 0;
    opacity: 1;
  }
  100% {
    translate: -14% 0;
    opacity: 0;
  }
}
</style>
