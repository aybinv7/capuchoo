<script setup lang="ts">
import { computed, ref } from "vue";
import { Button } from "@/components/ui/button";
import CopyButton from "@/shared/components/CopyButton.vue";
import { cn } from "@/lib/utils";

const props = defineProps<{ error: string }>();

const expanded = ref(false);
const long = computed(() => props.error.length > 160 || props.error.includes("\n"));
</script>

<template>
  <div
    class="border-destructive/20 bg-danger-soft/40 mt-1.5 flex items-start gap-1 rounded-md border px-2 py-1"
  >
    <pre
      :class="
        cn(
          'text-destructive min-w-0 flex-1 font-mono text-[11px] leading-relaxed break-all whitespace-pre-wrap',
          long && !expanded && 'line-clamp-2',
        )
      "
      >{{ props.error }}</pre>
    <div class="flex shrink-0 items-center">
      <Button
        v-if="long"
        variant="ghost"
        size="xs"
        class="text-muted-foreground h-5"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
        >{{ expanded ? "Less" : "More" }}</Button
      >
      <CopyButton :value="props.error" label="error" class="size-5" />
    </div>
  </div>
</template>
