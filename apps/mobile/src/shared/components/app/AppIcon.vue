<template>
  <MaterialShape
    :shape="shape"
    class="grid place-items-center"
    :class="tone"
    :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.36)}px` }"
  >
    <img
      v-if="iconUrl && !broken"
      :src="iconUrl"
      alt=""
      class="size-full object-cover"
      @error="broken = true"
    />
    <span v-else class="font-semibold tracking-tight select-none" aria-hidden="true">{{
      initials
    }}</span>
  </MaterialShape>
</template>

<script setup lang="ts">
import MaterialShape from "@/shared/components/shape/MaterialShape.vue";
import type { MaterialShapeName } from "@/shared/utils/shapes/materialShapes";

/**
 * An app as a cookie: its icon when it has one, otherwise its initials on a tone. The tone comes
 * from the bundle id, so an app is the same colour on every screen and every phone - a shape is
 * chosen from an id, never at random per render.
 */
const props = withDefaults(
  defineProps<{
    name: string;
    bundleId: string;
    iconUrl?: string | null;
    size?: number;
    shape?: MaterialShapeName;
  }>(),
  { iconUrl: null, size: 48, shape: "cookie9" },
);

const broken = ref(false);

const TONES = [
  "bg-tone-1 text-tone-1-foreground",
  "bg-tone-2 text-tone-2-foreground",
  "bg-tone-3 text-tone-3-foreground",
  "bg-tone-4 text-tone-4-foreground",
  "bg-tone-5 text-tone-5-foreground",
  "bg-tone-6 text-tone-6-foreground",
];

function hash(text: string): number {
  let value = 0;
  for (const char of text) value = (value * 31 + char.charCodeAt(0)) >>> 0;
  return value;
}

const tone = computed(() => TONES[hash(props.bundleId) % TONES.length]);

const initials = computed(() => {
  const words = props.name
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean);
  const letters = words.length > 1 ? words[0]![0]! + words[1]![0]! : (words[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
});
</script>
