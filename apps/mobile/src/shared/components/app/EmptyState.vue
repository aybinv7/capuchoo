<template>
  <div class="flex flex-col items-center gap-4 px-8 py-12 text-center">
    <MaterialShape
      :shape="shape"
      class="grid size-28 place-items-center bg-primary-container text-primary-container-foreground"
    >
      <F7Icon :md="`material:${icon}`" size="48" />
    </MaterialShape>
    <div class="flex max-w-72 flex-col gap-1">
      <p class="text-lg font-semibold">{{ title }}</p>
      <p v-if="text" class="text-sm text-muted-foreground">{{ text }}</p>
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
import MaterialShape from "@/shared/components/shape/MaterialShape.vue";
import type { MaterialShapeName } from "@/shared/utils/shapes/materialShapes";

/** A 112dp shape on primary-container with a 48dp glyph, one line, and the action that fills it. */
withDefaults(
  defineProps<{ icon: string; title: string; text?: string; shape?: MaterialShapeName }>(),
  {
    text: undefined,
    shape: "cookie12",
  },
);
</script>
