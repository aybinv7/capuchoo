<script setup lang="ts">
import CopyButton from "@/shared/components/CopyButton.vue";

const props = defineProps<{
  title: string;
  body: string;
  extra?: string | null;
  data?: Record<string, unknown> | null;
}>();
</script>

<template>
  <div class="space-y-2 p-3 text-xs">
    <div class="flex items-start gap-2">
      <p class="min-w-0 flex-1 font-mono break-words whitespace-pre-wrap" dir="auto">
        {{ props.title }}
      </p>
      <CopyButton
        :value="[props.title, props.body, props.extra].filter(Boolean).join('\n')"
        label="Copy"
      />
    </div>
    <pre
      v-if="props.body"
      class="bg-muted/60 max-h-72 overflow-auto rounded p-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap"
      >{{ props.body }}</pre>
    <pre
      v-if="props.data"
      class="bg-muted/60 max-h-72 overflow-auto rounded p-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap"
      >{{ JSON.stringify(props.data, null, 2) }}</pre>
    <p v-if="props.extra" class="text-muted-foreground">{{ props.extra }}</p>
  </div>
</template>
