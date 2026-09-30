<script setup lang="ts">
defineProps<{
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "success" | "danger";
}>();
</script>

<template>
  <div class="bg-card rounded-lg border px-4 py-3">
    <div class="text-muted-foreground text-xs">{{ label }}</div>
    <div
      class="mt-1 font-mono text-2xl font-semibold tracking-tight tabular"
      :class="tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-destructive' : ''"
    >
      {{ value }}
    </div>
    <div v-if="hint" class="text-muted-foreground mt-0.5 text-[11px]">
      {{ hint }}
    </div>
  </div>
</template>
