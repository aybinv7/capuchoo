<script setup lang="ts">
import { computed } from "vue";
import CopyButton from "@/shared/components/CopyButton.vue";
import { useCurrentApp } from "@/shared/composables/useCurrentApp";
import type { ConsoleLaneEntry } from "../../types/recordings.types";
import StackTrace from "./StackTrace.vue";

const props = defineProps<{ entry: ConsoleLaneEntry; version: string }>();
const { appId } = useCurrentApp();

const trace = computed(() =>
  props.entry.stack
    ? { label: "Stack", value: props.entry.stack }
    : props.entry.site
      ? { label: "Logged at", value: props.entry.site }
      : null,
);
</script>

<template>
  <div class="space-y-3 p-3 text-xs">
    <div class="flex items-start gap-2">
      <p class="min-w-0 flex-1 font-mono break-words whitespace-pre-wrap" dir="auto">
        {{ props.entry.text }}
      </p>
      <CopyButton
        :value="[props.entry.text, trace?.value].filter(Boolean).join('\n')"
        label="Copy"
      />
    </div>
    <StackTrace
      v-if="trace"
      :app-id="appId"
      :version="props.version"
      :stack="trace.value"
      :label="trace.label"
    />
    <p v-if="props.entry.source !== 'console'" class="text-muted-foreground">
      {{
        props.entry.source === "rejection" ? "An unhandled promise rejection" : "An uncaught error"
      }}
    </p>
  </div>
</template>
