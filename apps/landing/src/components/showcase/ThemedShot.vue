<script setup lang="ts">
import { computed } from "vue";
import { useTheme } from "@/composables/useTheme";
import { SCREEN_WIDTHS, type ScreenId } from "@/content/screens";

const props = withDefaults(
  defineProps<{
    id: ScreenId;
    alt: string;
    sizes?: string;
    eager?: boolean;
  }>(),
  { sizes: "(min-width: 1280px) 1200px, 100vw", eager: false },
);

const { isDark } = useTheme();
const theme = computed(() => (isDark.value ? "dark" : "light"));
const srcset = computed(() =>
  SCREEN_WIDTHS.map((width) => `/screens/${props.id}-${theme.value}-${width}.webp ${width}w`).join(
    ", ",
  ),
);
</script>

<template>
  <img
    :src="`/screens/${props.id}-${theme}-${SCREEN_WIDTHS[0]}.webp`"
    :srcset="srcset"
    :sizes="props.sizes"
    :alt="props.alt"
    width="1440"
    height="900"
    :loading="props.eager ? 'eager' : 'lazy'"
    :fetchpriority="props.eager ? 'high' : 'auto'"
    decoding="async"
    class="block aspect-[16/10] h-auto w-full"
  />
</template>
