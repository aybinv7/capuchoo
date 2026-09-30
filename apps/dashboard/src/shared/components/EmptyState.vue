<script setup lang="ts">
import type { Component } from "vue";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

defineProps<{ icon?: Component; title: string; description?: string }>();
</script>

<template>
  <Empty class="border border-dashed">
    <EmptyHeader>
      <EmptyMedia v-if="icon" variant="icon">
        <component :is="icon" />
      </EmptyMedia>
      <EmptyTitle>{{ title }}</EmptyTitle>
      <EmptyDescription v-if="description">{{ description }}</EmptyDescription>
    </EmptyHeader>
    <EmptyContent v-if="$slots.default">
      <slot />
    </EmptyContent>
  </Empty>
</template>
