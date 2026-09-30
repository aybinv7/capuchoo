<script setup lang="ts">
import { useIntervalFn } from "@vueuse/core";
import { computed, ref, watch } from "vue";
import { formatDuration } from "../lib/format";

const props = defineProps<{ from: string | null; to: string | null }>();

const now = ref(Date.now());
const { pause, resume } = useIntervalFn(() => (now.value = Date.now()), 1000, { immediate: false });

const running = computed(() => Boolean(props.from) && !props.to);
watch(
  running,
  (value) => {
    now.value = Date.now();
    if (value) resume();
    else pause();
  },
  { immediate: true },
);

const label = computed(() => formatDuration(props.from, props.to, now.value));
</script>

<template>
  <span class="font-mono tabular">{{ label }}</span>
</template>
