<template>
  <div class="group relative rounded-md bg-black/90 p-3 text-left font-mono text-xs text-white">
    <!-- pre, not code: these snippets are multi-line and copied verbatim, so the
         whitespace is part of the content. -->
    <pre class="overflow-x-auto whitespace-pre">{{ code }}</pre>
    <Button
      variant="ghost"
      size="icon"
      class="absolute top-2 right-2 h-6 w-6 text-muted-foreground hover:text-white"
      :aria-label="`Copy: ${code.split('\n')[0]}`"
      @click="emit('copy', code)"
    >
      <ILucideCopy class="h-3 w-3" />
    </Button>
  </div>
</template>

<script setup lang="ts">
defineProps<{ code: string }>();

const emit = defineEmits<{ (e: "copy", code: string): void }>();
</script>
