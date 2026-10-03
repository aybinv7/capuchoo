<script setup lang="ts">
import { computed, ref } from "vue";
import { cn } from "@/lib/utils";
import CopyButton from "@/shared/components/CopyButton.vue";
import { prettyBody } from "../../lib/display";
import type { NetworkLaneEntry } from "../../types/recordings.types";
import { statusTone } from "./rows";

const props = defineProps<{ entry: NetworkLaneEntry }>();
const tab = ref<"response" | "request">("response");

const headers = computed(() =>
  Object.entries(
    tab.value === "request" ? props.entry.requestHeaders : props.entry.responseHeaders,
  ),
);
const body = computed(() =>
  prettyBody(tab.value === "request" ? props.entry.requestBody : props.entry.responseBody),
);
</script>

<template>
  <div class="space-y-3 p-3 text-xs">
    <div class="flex items-start gap-2">
      <span class="font-mono font-semibold">{{ props.entry.method }}</span>
      <span
        :class="cn('rounded px-1.5 font-mono', statusTone(props.entry.status, props.entry.error))"
        >{{ props.entry.status ?? props.entry.error ?? "failed" }}</span
      >
      <span class="min-w-0 flex-1 font-mono break-all">{{ props.entry.url }}</span>
      <CopyButton :value="props.entry.url" label="Copy URL" />
    </div>
    <dl class="text-muted-foreground grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
      <dt>Duration</dt>
      <dd class="text-foreground tabular">{{ props.entry.duration }} ms</dd>
      <template v-if="props.entry.responseSize !== null">
        <dt>Size</dt>
        <dd class="text-foreground tabular">{{ props.entry.responseSize }} bytes</dd>
      </template>
      <dt>Transport</dt>
      <dd class="text-foreground">{{ props.entry.transport }}</dd>
      <template v-if="props.entry.traceId">
        <dt>Trace</dt>
        <dd class="text-foreground font-mono break-all">{{ props.entry.traceId }}</dd>
      </template>
    </dl>

    <div class="flex gap-1 border-b">
      <button
        v-for="name in ['response', 'request'] as const"
        :key="name"
        type="button"
        :class="
          cn(
            '-mb-px border-b-2 px-2 py-1 capitalize',
            tab === name
              ? 'border-primary text-foreground'
              : 'text-muted-foreground border-transparent',
          )
        "
        @click="tab = name"
      >
        {{ name }}
      </button>
    </div>
    <dl v-if="headers.length > 0" class="grid grid-cols-[minmax(0,10rem)_1fr] gap-x-3 gap-y-0.5">
      <template v-for="[name, value] in headers" :key="name">
        <dt class="text-muted-foreground truncate font-mono">{{ name }}</dt>
        <dd class="font-mono break-all">{{ value }}</dd>
      </template>
    </dl>
    <pre
      v-if="body"
      class="bg-muted/60 max-h-72 overflow-auto rounded p-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap"
      >{{ body }}</pre>
    <p v-else class="text-muted-foreground text-pretty">
      No body recorded. Bodies are kept only when the recording rules ask for them.
    </p>
  </div>
</template>
