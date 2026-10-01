<template>
  <div
    class="scene relative mx-auto grid aspect-square w-full place-items-center"
    :class="{ 'is-active': active }"
  >
    <div
      class="phone flex h-[88%] w-[56%] flex-col items-center justify-center gap-5 rounded-[36px] bg-muted p-5 shadow-float"
    >
      <span class="relative">
        <MaterialShape
          shape="cookie12"
          class="app grid size-20 place-items-center bg-tone-1 text-tone-1-foreground"
        >
          <F7Icon md="material:storefront" size="34" />
        </MaterialShape>
        <MaterialShape
          shape="burst"
          class="done absolute -end-3 -bottom-2 grid size-9 place-items-center bg-env-prod text-primary-foreground"
        >
          <F7Icon md="material:check" size="18" />
        </MaterialShape>
      </span>

      <span class="flex w-full flex-col items-center gap-2">
        <span class="h-2 w-full overflow-hidden rounded-full bg-card">
          <span class="bar block h-full w-full origin-left rounded-full bg-primary" />
        </span>
        <span class="cap-mono text-xs font-semibold text-muted-foreground">1.5.0 → 1.6.0</span>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import MaterialShape from "@/shared/components/shape/MaterialShape.vue";

/** The download fills, the app settles, a check lands: one tap from a channel to this phone. */
defineProps<{ active: boolean }>();
</script>

<style scoped>
.bar {
  scale: 0.08 1;
}

.done {
  scale: 0;
}

.scene.is-active .bar {
  animation: fill 3.6s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

.scene.is-active .done {
  animation: land 3.6s cubic-bezier(0.34, 1.6, 0.64, 1) infinite;
}

.scene.is-active .app {
  animation: settle 3.6s cubic-bezier(0.34, 1.4, 0.64, 1) infinite;
}

@keyframes fill {
  0% {
    scale: 0.08 1;
  }
  55%,
  100% {
    scale: 1 1;
  }
}

@keyframes land {
  0%,
  58% {
    scale: 0;
    rotate: -90deg;
  }
  68%,
  92% {
    scale: 1;
    rotate: 0deg;
  }
  100% {
    scale: 0;
  }
}

@keyframes settle {
  0%,
  56% {
    scale: 1;
  }
  62% {
    scale: 0.88;
  }
  72%,
  100% {
    scale: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .bar {
    scale: 1 1;
  }

  .done {
    scale: 1;
  }

  .scene.is-active .bar,
  .scene.is-active .done,
  .scene.is-active .app {
    animation: none;
  }
}
</style>
