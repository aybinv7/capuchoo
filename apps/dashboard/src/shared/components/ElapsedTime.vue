<script setup lang="ts">
import { computed } from "vue";
import { useSecondClock } from "../composables/useSecondClock";
import { formatDuration } from "../lib/format";

const props = defineProps<{ from: string | null; to: string | null }>();

const running = computed(() => Boolean(props.from) && !props.to);
const now = useSecondClock(running);

const label = computed(() => formatDuration(props.from, props.to, now.value));
</script>

<template>
  <span class="font-mono tabular">{{ label }}</span>
</template>
