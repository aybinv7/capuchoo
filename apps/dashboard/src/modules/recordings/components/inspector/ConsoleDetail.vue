<script setup lang="ts">
import CopyButton from "@/shared/components/CopyButton.vue";
import { useCurrentApp } from "@/shared/composables/useCurrentApp";
import type { ConsoleLaneEntry } from "../../types/recordings.types";
import StackTrace from "./StackTrace.vue";

const props = defineProps<{ entry: ConsoleLaneEntry; version: string }>();
const { appId } = useCurrentApp();
</script>

<template>
  <div class="space-y-3 p-3 text-xs">
    <div class="flex items-start gap-2">
      <p class="min-w-0 flex-1 font-mono break-words whitespace-pre-wrap" dir="auto">
        {{ props.entry.text }}
      </p>
      <CopyButton
        :value="[props.entry.text, props.entry.stack].filter(Boolean).join('\n')"
        label="Copy"
      />
    </div>
    <StackTrace
      v-if="props.entry.stack"
      :app-id="appId"
      :version="props.version"
      :stack="props.entry.stack"
    />
    <p v-if="props.entry.source !== 'console'" class="text-muted-foreground">
      From an {{ props.entry.source }} error
    </p>
  </div>
</template>
