<script setup lang="ts">
defineProps<{ title: string; description?: string }>();
</script>

<template>
  <header class="flex flex-wrap items-end justify-between gap-4 border-b pb-4">
    <div class="min-w-0 space-y-1">
      <div v-if="$slots.eyebrow" class="text-muted-foreground flex items-center gap-2 text-xs">
        <slot name="eyebrow" />
      </div>
      <h1 class="flex items-center gap-2 truncate text-xl font-semibold tracking-tight">
        {{ title }}
        <slot name="badges" />
      </h1>
      <p v-if="description" class="text-muted-foreground max-w-2xl text-sm text-pretty">
        {{ description }}
      </p>
    </div>
    <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2">
      <slot name="actions" />
    </div>
  </header>
</template>
