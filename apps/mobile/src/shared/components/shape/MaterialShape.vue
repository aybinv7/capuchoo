<template>
  <div :style="style">
    <slot />
  </div>
</template>

<script setup lang="ts">
import type { CSSProperties } from "vue";
import { materialShapeMask, type MaterialShapeName } from "@/shared/utils/shapes/materialShapes";

/**
 * Cuts its content - a photo, a glyph on a tone - to one of Material 3 Expressive's shapes. It is
 * a mask, not a clip path, so it scales with the element and needs nothing mounted elsewhere.
 * Give it a square box; the shapes are normalised to one.
 */
const props = defineProps<{ shape: MaterialShapeName }>();

const style = computed<CSSProperties>(() => {
  const mask = materialShapeMask(props.shape);
  return {
    maskImage: mask,
    WebkitMaskImage: mask,
    maskSize: "100% 100%",
    WebkitMaskSize: "100% 100%",
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
  };
});
</script>
