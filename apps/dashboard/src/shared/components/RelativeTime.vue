<script setup lang="ts">
import { computed, onScopeDispose } from "vue";
import { useNow } from "../composables/useNow";
import { formatDateTime, formatRelative } from "../lib/format";

const props = defineProps<{ value: string | null | undefined }>();

const clock = useNow();
onScopeDispose(clock.release);

const label = computed(() => formatRelative(props.value, clock.now.value));
const title = computed(() => formatDateTime(props.value));
</script>

<template>
  <time :datetime="props.value ?? undefined" :title="title" class="tabular whitespace-nowrap">{{
    label
  }}</time>
</template>
