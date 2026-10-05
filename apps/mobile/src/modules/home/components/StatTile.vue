<template>
  <div class="stat-tile">
    <MaterialShape :shape="shape" class="grid size-9 place-items-center" :class="tone">
      <F7Icon :md="`material:${icon}`" size="18" />
    </MaterialShape>
    <span class="cap-mono mt-3 text-[28px] leading-8 font-bold tracking-tight tabular-nums">{{
      value
    }}</span>
    <span class="text-sm text-muted-foreground">{{ label }}</span>
  </div>
</template>

<script setup lang="ts">
import MaterialShape from "@/shared/components/shape/MaterialShape.vue";
import type { MaterialShapeName } from "@/shared/utils/shapes/materialShapes";

/** One number with its name; the shape and tone tell tiles apart before the label is read. */
withDefaults(
  defineProps<{
    icon: string;
    value: string;
    label: string;
    shape?: MaterialShapeName;
    tone?: string;
  }>(),
  { shape: "cookie9", tone: "bg-secondary text-secondary-foreground" },
);
</script>

<style scoped>
.stat-tile {
  display: flex;
  flex-direction: column;
  padding: 16px;
  border-radius: var(--radius-xl);
  background: var(--card);
  color: var(--card-foreground);
}
</style>
