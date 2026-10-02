<script setup lang="ts">
import { Copy } from "@lucide/vue";
import { useCopyToast } from "@/shared/composables/useCopyToast";

const props = defineProps<{ value: string; label: string; prefix?: string }>();

const { copyText } = useCopyToast();
</script>

<template>
  <button
    type="button"
    class="group/id hover:text-foreground focus-visible:ring-ring/50 inline-flex max-w-full min-w-0 cursor-copy items-center gap-1 rounded-sm outline-none focus-visible:ring-3"
    :title="`${props.value} · click to copy`"
    :aria-label="`Copy ${props.label} ${props.value}`"
    @click="copyText(props.value, props.label)"
  >
    <span v-if="props.prefix" class="shrink-0">{{ props.prefix }}</span>
    <span class="max-w-[18ch] truncate font-mono">{{ props.value }}</span>
    <Copy
      class="size-3 shrink-0 opacity-0 transition-opacity group-hover/id:opacity-100 group-focus-visible/id:opacity-100"
      aria-hidden="true"
    />
  </button>
</template>
