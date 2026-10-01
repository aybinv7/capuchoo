<template>
  <button
    type="button"
    class="seed-swatch"
    :class="{ selected }"
    :style="{
      '--seed-p': colors.primary,
      '--seed-s': colors.secondary,
      '--seed-t': colors.tertiary,
    }"
    :aria-label="label"
    :aria-pressed="selected"
    @click="emit('pick')"
  >
    <span class="seed-disc" aria-hidden="true" />
    <span class="seed-check" aria-hidden="true">
      <F7Icon md="material:check" size="18" />
    </span>
  </button>
</template>

<script setup lang="ts">
import type { SchemePreview } from "../composables/useSchemePreviews";

/**
 * A seed as Android's Wallpaper & style shows one: the primary over the top half, the secondary
 * and tertiary containers below it, so the whole palette a seed produces is read at a glance.
 */
defineProps<{ colors: SchemePreview; label: string; selected: boolean }>();
const emit = defineEmits<{ pick: [] }>();
</script>

<style scoped>
.seed-swatch {
  position: relative;
  display: grid;
  place-items: center;
  aspect-ratio: 1;
  width: 100%;
  border-radius: var(--radius-xl);
  background: var(--muted);
  transition:
    border-radius var(--duration-medium) var(--ease-spring-fast),
    background-color var(--duration-short) linear;
}

.seed-swatch.selected {
  border-radius: var(--radius-lg);
  background: var(--primary-container);
}

.seed-disc {
  width: 72%;
  aspect-ratio: 1;
  border-radius: 999px;
  background: conic-gradient(
    from -90deg,
    var(--seed-p) 0 50%,
    var(--seed-t) 50% 75%,
    var(--seed-s) 75% 100%
  );
  transition: scale var(--duration-medium) var(--ease-spring-fast);
}

.seed-swatch:active .seed-disc {
  scale: 0.9;
}

.seed-check {
  position: absolute;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: var(--primary);
  color: var(--primary-foreground);
  scale: 0;
  transition: scale var(--duration-medium) var(--ease-spring-fast);
}

.seed-swatch.selected .seed-check {
  scale: 1;
}

@media (prefers-reduced-motion: reduce) {
  .seed-swatch,
  .seed-disc,
  .seed-check {
    transition-duration: 0ms;
  }
}
</style>
