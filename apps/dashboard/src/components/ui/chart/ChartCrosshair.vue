<script setup lang="ts">
import type { Component } from "vue";
import { VisCrosshair as VisCrosshairComponent } from "@unovis/vue";

interface ChartCrosshairProps {
  [key: string]: any;
}

const props = defineProps<ChartCrosshairProps>();

// @unovis/vue does not declare its default slot, so its slots type is `{}` and
// strict template checking rejects `#default`. Widening to `Component` restores
// permissive slot checking; the runtime component is untouched.
const VisCrosshair = VisCrosshairComponent as Component;
</script>

<template>
  <VisCrosshair v-bind="props">
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </VisCrosshair>
</template>
