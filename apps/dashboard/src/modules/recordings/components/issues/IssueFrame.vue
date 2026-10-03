<script setup lang="ts">
import { computed } from "vue";
import { useSymbolicatedStack } from "../../composables/useSymbolicatedStack";

const props = defineProps<{ appId: string; version: string; frame: string }>();

const { frames, state } = useSymbolicatedStack({
  appId: () => props.appId,
  version: () => props.version,
  stack: () => props.frame,
});

const location = computed(() => {
  const first = frames.value[0];
  if (state.value === "ready" && first?.original) {
    const name = first.original.name ?? first.fn;
    return `${first.original.source}:${first.original.line}${name ? ` in ${name}` : ""}`;
  }
  return props.frame.replace(/^at /, "");
});
</script>

<template>
  <span
    class="text-muted-foreground block truncate font-mono text-[11px]"
    :class="state === 'ready' && frames[0]?.original && 'text-foreground/80'"
    :title="props.frame"
    >{{ location }}</span
  >
</template>
