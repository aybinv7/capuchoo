<script setup lang="ts">
import { BadgeCheck, Hammer, Smartphone } from "@lucide/vue";
import { computed, useTemplateRef } from "vue";
import { useReducedMotion } from "@/composables/useReducedMotion";
import { useScrollProgress } from "@/composables/useScrollProgress";
import BrowserFrame from "./BrowserFrame.vue";
import ThemedShot from "./ThemedShot.vue";

const stage = useTemplateRef<HTMLElement>("stage");
const { progress } = useScrollProgress(stage, "enter");
const reduced = useReducedMotion();

const ease = (value: number) => 1 - (1 - value) ** 3;
const settled = computed(() => (reduced.value ? 1 : ease(Math.min(1, progress.value * 1.35))));
const frameStyle = computed(() => ({
  transform: `perspective(1600px) rotateX(${(1 - settled.value) * 20}deg) scale(${0.92 + settled.value * 0.08})`,
}));
const chip = (depth: number) =>
  computed(() => ({
    transform: `translate3d(0, ${(1 - settled.value) * depth}px, 0)`,
    opacity: String(0.25 + settled.value * 0.75),
  }));
const chipA = chip(60);
const chipB = chip(90);
const chipC = chip(40);
</script>

<template>
  <div ref="stage" class="relative mx-auto mt-12 w-full max-w-6xl px-2 md:mt-14">
    <div
      aria-hidden="true"
      class="bg-primary/25 pointer-events-none absolute inset-x-[10%] top-[18%] h-2/3 rounded-full blur-[90px]"
    />
    <div class="relative">
      <div class="relative origin-[50%_0%] will-change-transform" :style="frameStyle">
        <BrowserFrame path="release/canvas">
          <ThemedShot
            id="canvas"
            eager
            sizes="(min-width: 1200px) 1150px, 100vw"
            alt="The Capuchoo release canvas: builds, the dev, staging and prod channels, and three customer channels following prod"
          />
        </BrowserFrame>
      </div>

      <div
        class="bg-card/95 absolute top-[36%] -left-10 hidden items-center gap-3 rounded-xl border px-3.5 py-2.5 shadow-xl backdrop-blur lg:flex"
        :style="chipA"
      >
        <span class="bg-success/15 text-success grid size-8 place-items-center rounded-lg">
          <Smartphone class="size-4" />
        </span>
        <div class="text-left leading-tight">
          <p class="font-mono text-xs font-medium">prod-contoso → 1.9.1</p>
          <p class="text-muted-foreground text-[11px]">43 of 46 tablets updated</p>
        </div>
      </div>

      <div
        class="bg-card/95 absolute top-[70%] -right-10 hidden items-center gap-3 rounded-xl border px-3.5 py-2.5 shadow-xl backdrop-blur lg:flex"
        :style="chipB"
      >
        <span class="bg-primary/15 text-primary grid size-8 place-items-center rounded-lg">
          <BadgeCheck class="size-4" />
        </span>
        <div class="text-left leading-tight">
          <p class="text-xs font-medium">Signature verified</p>
          <p class="text-muted-foreground font-mono text-[11px]">ECDSA P-256 · sha256</p>
        </div>
      </div>

      <div
        class="bg-card/95 absolute -bottom-5 left-[42%] hidden items-center gap-3 rounded-xl border px-3.5 py-2.5 shadow-xl backdrop-blur md:flex"
        :style="chipC"
      >
        <span class="bg-info/15 text-info grid size-8 place-items-center rounded-lg">
          <Hammer class="size-4" />
        </span>
        <div class="text-left leading-tight">
          <p class="text-xs font-medium">GitLab pipeline · 1.10.0-dev.8</p>
          <p class="text-muted-foreground text-[11px]">sync step running, live</p>
        </div>
      </div>
    </div>

    <p class="text-muted-foreground mt-10 text-center text-xs">
      The real dashboard, on a fictional demo organization.
    </p>
  </div>
</template>
