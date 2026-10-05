<script setup lang="ts">
import { Lock } from "@lucide/vue";
import { cn } from "@/lib/utils";

const props = withDefaults(defineProps<{ path?: string; class?: string }>(), {
  path: "",
  class: undefined,
});
</script>

<template>
  <div
    :class="
      cn(
        'bg-card overflow-hidden rounded-xl border shadow-[0_30px_80px_-20px_rgb(0_0_0/0.35),0_0_0_1px_rgb(0_0_0/0.03)]',
        props.class,
      )
    "
  >
    <div class="bg-muted/60 flex h-9 items-center gap-3 border-b px-3.5">
      <div class="flex gap-1.5" aria-hidden="true">
        <span class="size-2.5 rounded-full bg-[#ff5f57]/80" />
        <span class="size-2.5 rounded-full bg-[#febc2e]/80" />
        <span class="size-2.5 rounded-full bg-[#28c840]/80" />
      </div>
      <div
        class="bg-background/70 text-muted-foreground mx-auto flex h-6 max-w-sm min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-[11px]"
      >
        <Lock class="size-3 shrink-0" aria-hidden="true" />
        <span class="truncate">updates.northwind.example/{{ props.path }}</span>
      </div>
      <span class="w-10" aria-hidden="true" />
    </div>
    <slot />
  </div>
</template>
