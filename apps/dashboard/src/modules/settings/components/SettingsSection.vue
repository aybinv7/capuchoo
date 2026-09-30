<script setup lang="ts">
defineProps<{ title: string; description?: string }>();
</script>

<template>
  <section class="bg-card rounded-lg border">
    <header class="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
      <div class="space-y-1">
        <h2 class="text-sm font-semibold">{{ title }}</h2>
        <p v-if="description" class="text-muted-foreground max-w-2xl text-sm text-pretty">
          {{ description }}
        </p>
      </div>
      <div v-if="$slots.actions" class="flex items-center gap-2">
        <slot name="actions" />
      </div>
    </header>
    <div class="px-5 py-4">
      <slot />
    </div>
    <footer
      v-if="$slots.footer"
      class="bg-surface flex items-center justify-end gap-2 rounded-b-lg border-t px-5 py-3"
    >
      <slot name="footer" />
    </footer>
  </section>
</template>
