<template>
  <div
    class="scene relative mx-auto flex aspect-square w-full flex-col justify-center gap-3"
    :class="{ 'is-active': active }"
  >
    <div
      v-for="(lane, position) in LANES"
      :key="lane.id"
      class="lane flex h-16 items-center gap-3 rounded-[20px] bg-card ps-16 pe-4 shadow-card"
      :style="{ '--lane-delay': `${position * STEP_MS}ms`, '--lane-ring': `var(--env-${lane.id})` }"
    >
      <span class="size-2.5 shrink-0 rounded-full" :class="lane.dot" />
      <span class="text-sm font-semibold text-foreground">{{ lane.id }}</span>
      <span class="cap-mono ms-auto text-sm font-semibold text-muted-foreground">{{
        lane.version
      }}</span>
    </div>

    <MaterialShape
      shape="cookie9"
      class="token absolute start-3 top-1/2 grid size-11 place-items-center bg-primary text-primary-foreground"
      aria-hidden="true"
    >
      <F7Icon md="material:android" size="22" />
    </MaterialShape>
  </div>
</template>

<script setup lang="ts">
import MaterialShape from "@/shared/components/shape/MaterialShape.vue";

const STEP_MS = 1400;

const LANES = [
  { id: "dev", dot: "bg-env-dev", version: "1.6.0" },
  { id: "staging", dot: "bg-env-staging", version: "1.5.2" },
  { id: "prod", dot: "bg-env-prod", version: "1.5.0" },
] as const;

/** A build hops from dev to staging to prod, each lane lighting as it lands: promotion, pictured. */
defineProps<{ active: boolean }>();
</script>

<style scoped>
.token {
  translate: 0 calc(-50% - 76px);
}

.scene.is-active .token {
  animation: token-hop 4.2s cubic-bezier(0.34, 1.4, 0.64, 1) infinite;
}

.scene.is-active .lane {
  animation: lane-land 4.2s linear var(--lane-delay) infinite;
}

@keyframes token-hop {
  0%,
  22% {
    translate: 0 calc(-50% - 76px);
    rotate: 0deg;
  }
  33%,
  55% {
    translate: 0 -50%;
    rotate: 120deg;
  }
  66%,
  92% {
    translate: 0 calc(-50% + 76px);
    rotate: 240deg;
  }
  100% {
    translate: 0 calc(-50% - 76px);
    rotate: 360deg;
  }
}

@keyframes lane-land {
  0%,
  4% {
    box-shadow:
      inset 0 0 0 0 var(--lane-ring),
      var(--elevation-card);
  }
  8%,
  24% {
    box-shadow:
      inset 0 0 0 2px var(--lane-ring),
      var(--elevation-raised);
  }
  30%,
  100% {
    box-shadow:
      inset 0 0 0 0 var(--lane-ring),
      var(--elevation-card);
  }
}

@media (prefers-reduced-motion: reduce) {
  .scene.is-active .token,
  .scene.is-active .lane {
    animation: none;
  }
}
</style>
