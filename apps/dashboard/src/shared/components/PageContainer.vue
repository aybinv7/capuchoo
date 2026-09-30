<script setup lang="ts">
import { cn } from "@/lib/utils";

const props = withDefaults(
  defineProps<{ width?: "default" | "narrow" | "wide"; class?: string }>(),
  {
    width: "default",
  },
);

const WIDTH = { narrow: "max-w-3xl", default: "max-w-6xl", wide: "max-w-[1600px]" } as const;
</script>

<template>
  <div :class="cn('mx-auto w-full space-y-6 px-4 py-6 md:px-6', WIDTH[props.width], props.class)">
    <slot />
  </div>
</template>
