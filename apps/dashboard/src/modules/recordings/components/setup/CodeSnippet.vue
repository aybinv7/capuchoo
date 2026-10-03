<script setup lang="ts">
import { FileCode2, SquareTerminal } from "@lucide/vue";
import CopyButton from "@/shared/components/CopyButton.vue";
import type { Snippet } from "../../lib/setup-snippets";

const props = defineProps<{ snippet: Snippet }>();
</script>

<template>
  <figure class="bg-muted/40 overflow-hidden rounded-lg border">
    <figcaption
      class="text-muted-foreground flex items-center gap-2 border-b px-3 py-1.5 font-mono text-[11px]"
    >
      <SquareTerminal
        v-if="props.snippet.language === 'bash'"
        class="size-3.5"
        aria-hidden="true"
      />
      <FileCode2 v-else class="size-3.5" aria-hidden="true" />
      <span class="min-w-0 flex-1 truncate">{{ props.snippet.file }}</span>
      <CopyButton :value="props.snippet.code" :label="props.snippet.file" />
    </figcaption>
    <pre
      class="overflow-x-auto px-3 py-2.5 font-mono text-[12px] leading-relaxed"
    ><code>{{ props.snippet.code }}</code></pre>
  </figure>
</template>
