<script setup lang="ts">
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/shared/lib/format";
import type { BuildEvent } from "@/shared/types/build";

const props = defineProps<{ events: readonly BuildEvent[]; startedAt: string | null }>();

const TONE: Record<BuildEvent["status"], string> = {
  running: "bg-info",
  succeeded: "bg-success",
  failed: "bg-destructive",
  skipped: "bg-warning",
  info: "bg-muted-foreground/50",
};

/** `+1m 04s` from the build start, which reads better than a wall clock for a pipeline. */
function offset(at: string): string {
  if (!props.startedAt) return "";
  const seconds = Math.max(0, Math.round((Date.parse(at) - Date.parse(props.startedAt)) / 1000));
  const minutes = Math.floor(seconds / 60);
  return minutes ? `+${minutes}m ${String(seconds % 60).padStart(2, "0")}s` : `+${seconds}s`;
}
</script>

<template>
  <ol class="relative">
    <li
      v-for="event in props.events"
      :key="event.id"
      class="grid grid-cols-[4.5rem_1rem_1fr] gap-x-3 pb-3 last:pb-0"
    >
      <span
        class="text-muted-foreground pt-0.5 text-right font-mono text-[11px] tabular"
        :title="formatDateTime(event.created_at)"
        >{{ offset(event.created_at) }}</span
      >
      <span class="relative flex justify-center">
        <span class="bg-border absolute top-4 -bottom-3 w-px" />
        <span
          :class="
            cn(
              'relative mt-1.5 size-2 rounded-full',
              TONE[event.status],
              event.status === 'running' && 'animate-pulse',
            )
          "
        />
      </span>
      <div class="min-w-0 text-sm">
        <div class="flex items-center gap-2">
          <span class="font-mono font-medium">{{ event.step }}</span>
          <span class="text-muted-foreground text-xs">{{ event.status }}</span>
        </div>
        <p
          v-if="event.message"
          class="text-muted-foreground font-mono text-xs break-words whitespace-pre-wrap"
        >
          {{ event.message }}
        </p>
      </div>
    </li>
  </ol>
</template>
