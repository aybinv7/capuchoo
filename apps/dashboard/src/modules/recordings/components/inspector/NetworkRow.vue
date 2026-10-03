<script setup lang="ts">
import { cn } from "@/lib/utils";
import type { NetworkLaneEntry } from "../../types/recordings.types";
import { hostOf, pathOf, statusTone } from "./rows";

const props = defineProps<{ entry: NetworkLaneEntry }>();
</script>

<template>
  <span class="text-muted-foreground w-11 shrink-0 font-mono text-[10px] font-semibold">{{
    props.entry.method
  }}</span>
  <span
    :class="
      cn(
        'tabular w-9 shrink-0 rounded px-1 text-center font-mono text-[10px]',
        statusTone(props.entry.status, props.entry.error),
      )
    "
    >{{ props.entry.status ?? "ERR" }}</span
  >
  <span class="min-w-0 flex-1 truncate font-mono text-[11px]" :title="props.entry.url">
    <span class="text-muted-foreground">{{ hostOf(props.entry.url) }}</span
    >{{ pathOf(props.entry.url) }}
  </span>
  <span class="text-muted-foreground tabular shrink-0 text-[10px]"
    >{{ props.entry.duration }} ms</span
  >
</template>
