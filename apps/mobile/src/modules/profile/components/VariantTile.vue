<template>
  <button
    type="button"
    class="variant-tile"
    :class="{ selected }"
    :aria-pressed="selected"
    @click="emit('pick')"
  >
    <span class="variant-art" :style="{ background: colors.surface }" aria-hidden="true">
      <span class="variant-bar" :style="{ background: colors.primary }" />
      <span class="flex gap-1">
        <span class="variant-dot" :style="{ background: colors.secondary }" />
        <span class="variant-dot" :style="{ background: colors.tertiary }" />
      </span>
      <F7Icon v-if="selected" md="material:check_circle" size="20" class="variant-check" />
    </span>
    <span class="variant-label">{{ label }}</span>
  </button>
</template>

<script setup lang="ts">
import type { SchemePreview } from "../composables/useSchemePreviews";

/** One Material style applied to the current seed: its surface, primary and two containers. */
defineProps<{ colors: SchemePreview; label: string; selected: boolean }>();
const emit = defineEmits<{ pick: [] }>();
</script>

<style scoped>
.variant-tile {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 96px;
  scroll-snap-align: start;
}

.variant-art {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 6px;
  width: 100%;
  height: 76px;
  padding: 10px;
  border-radius: var(--radius-lg);
  box-shadow: inset 0 0 0 1px var(--border);
  transition:
    border-radius var(--duration-medium) var(--ease-spring-fast),
    box-shadow var(--duration-short) linear;
}

.variant-tile.selected .variant-art {
  border-radius: var(--radius-xl);
  box-shadow: inset 0 0 0 3px var(--primary);
}

.variant-tile:active .variant-art {
  scale: 0.96;
}

.variant-bar {
  height: 14px;
  width: 70%;
  border-radius: 999px;
}

.variant-dot {
  width: 18px;
  height: 18px;
  border-radius: 999px;
}

.variant-check {
  position: absolute;
  top: 8px;
  inset-inline-end: 8px;
  color: var(--primary);
}

.variant-label {
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
  color: var(--muted-foreground);
}

.variant-tile.selected .variant-label {
  color: var(--foreground);
  font-weight: 700;
}
</style>
