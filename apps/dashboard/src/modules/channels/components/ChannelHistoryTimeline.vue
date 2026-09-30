<script setup lang="ts">
import {
  ArrowRight,
  CircleDot,
  CirclePause,
  CirclePlay,
  CircleX,
  History,
  Rocket,
} from "@lucide/vue";
import type { Component } from "vue";
import RelativeTime from "@/shared/components/RelativeTime.vue";
import { cn } from "@/lib/utils";
import type { ChannelAction, ChannelHistoryEntry } from "@/shared/types/release";

defineProps<{ entries: readonly ChannelHistoryEntry[] }>();

const VIEW: Record<ChannelAction, { label: string; icon: Component; tone: string }> = {
  point_bundle: { label: "Delivered bundle", icon: Rocket, tone: "text-success bg-success-soft" },
  point_native: {
    label: "Delivered native build",
    icon: Rocket,
    tone: "text-success bg-success-soft",
  },
  rollback_bundle: {
    label: "Rolled back bundle",
    icon: History,
    tone: "text-warning bg-warning-soft",
  },
  rollback_native: {
    label: "Rolled back native build",
    icon: History,
    tone: "text-warning bg-warning-soft",
  },
  clear_bundle: { label: "Cleared bundle", icon: CircleX, tone: "text-muted-foreground bg-muted" },
  clear_native: {
    label: "Cleared native build",
    icon: CircleX,
    tone: "text-muted-foreground bg-muted",
  },
  pause: { label: "Paused", icon: CirclePause, tone: "text-destructive bg-danger-soft" },
  resume: { label: "Resumed", icon: CirclePlay, tone: "text-info bg-info-soft" },
};

/** A newer server may record actions this build does not know; show them instead of failing. */
const viewOf = (action: string) =>
  VIEW[action as ChannelAction] ?? {
    label: action.replace(/_/g, " "),
    icon: CircleDot,
    tone: "text-muted-foreground bg-muted",
  };
</script>

<template>
  <ol class="relative space-y-0">
    <li v-for="entry in entries" :key="entry.id" class="relative flex gap-3 pb-5 last:pb-0">
      <span class="bg-border absolute top-7 bottom-0 left-3.5 w-px" aria-hidden="true" />
      <span
        :class="
          cn(
            'relative grid size-7 shrink-0 place-items-center rounded-full',
            viewOf(entry.action).tone,
          )
        "
      >
        <component :is="viewOf(entry.action).icon" class="size-3.5" />
      </span>
      <div class="min-w-0 flex-1 pt-0.5 text-sm">
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span class="font-medium">{{ viewOf(entry.action).label }}</span>
          <span
            v-if="entry.from_version || entry.to_version"
            class="flex items-center gap-1 font-mono text-xs"
          >
            <span class="text-muted-foreground">{{ entry.from_version ?? "none" }}</span>
            <ArrowRight class="text-muted-foreground size-3" />
            <span>{{ entry.to_version ?? "none" }}</span>
          </span>
        </div>
        <div class="text-muted-foreground mt-0.5 flex flex-wrap gap-x-2 text-xs">
          <RelativeTime :value="entry.created_at" />
          <span
            >by
            {{ entry.actor_email ?? (entry.actor_api_key_id ? "an API key" : "the system") }}</span
          >
        </div>
        <p
          v-if="entry.reason"
          class="bg-surface mt-1.5 rounded-md border px-2.5 py-1.5 text-xs text-pretty"
        >
          {{ entry.reason }}
        </p>
      </div>
    </li>
  </ol>
</template>
