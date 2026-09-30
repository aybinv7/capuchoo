<script setup lang="ts">
import { useEventListener, useRafFn } from "@vueuse/core";
import { ref, useTemplateRef } from "vue";

const props = withDefaults(defineProps<{ size?: number }>(), { size: 48 });

const root = useTemplateRef<HTMLElement>("root");
const lit = ref(false);
let pending: { x: number; y: number } | null = null;

const { pause, resume } = useRafFn(
  () => {
    if (!pending || !root.value) return;
    const rect = root.value.getBoundingClientRect();
    root.value.style.setProperty("--spot-x", `${pending.x - rect.left}px`);
    root.value.style.setProperty("--spot-y", `${pending.y - rect.top}px`);
    pending = null;
    pause();
  },
  { immediate: false },
);

useEventListener(
  () => root.value?.parentElement,
  "pointermove",
  (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    pending = { x: event.clientX, y: event.clientY };
    if (!lit.value) lit.value = true;
    resume();
  },
  { passive: true },
);

useEventListener(
  () => root.value?.parentElement,
  "pointerleave",
  () => {
    lit.value = false;
  },
  { passive: true },
);
</script>

<template>
  <div
    ref="root"
    aria-hidden="true"
    class="grid-backdrop pointer-events-none absolute inset-0 overflow-hidden"
    :class="lit && 'is-lit'"
    :style="{ '--cell': `${props.size}px` }"
  >
    <div class="grid-lines absolute inset-[-10%]" />
    <div class="grid-spot absolute inset-0" />
  </div>
</template>

<style scoped>
.grid-backdrop {
  mask-image: radial-gradient(ellipse 70% 60% at 50% 40%, black 35%, transparent 100%);
}

.grid-lines {
  background-image:
    linear-gradient(to right, var(--grid-line) 1px, transparent 1px),
    linear-gradient(to bottom, var(--grid-line) 1px, transparent 1px);
  background-size: var(--cell) var(--cell);
  animation: drift 18s linear infinite;
  will-change: transform;
}

.grid-spot {
  opacity: 0;
  transition: opacity 300ms ease;
  background: radial-gradient(
    180px circle at var(--spot-x, 50%) var(--spot-y, 50%),
    color-mix(in oklch, var(--primary) 18%, transparent),
    transparent 70%
  );
}

.is-lit .grid-spot {
  opacity: 1;
}

@keyframes drift {
  to {
    transform: translate(calc(var(--cell) * -1), calc(var(--cell) * -1));
  }
}

@media (prefers-reduced-motion: reduce) {
  .grid-lines {
    animation: none;
  }
}
</style>
