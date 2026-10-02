<script setup lang="ts">
import { ArrowRight, CirclePause, CirclePlay, CircleX, History, Rocket } from "@lucide/vue";
import { computed, onScopeDispose, type Component } from "vue";
import { cn } from "@/lib/utils";
import RelativeTime from "@/shared/components/RelativeTime.vue";
import { useNow } from "@/shared/composables/useNow";
import { dayKeyFormatter, dayLabel } from "@/shared/period/lib/day-heading";
import type { ChannelHistoryEntry } from "@/shared/types/release";
import {
  groupHistory,
  historyActor,
  historyKind,
  historyLabel,
  type HistoryKind,
} from "../lib/channel-history";

const props = defineProps<{ entries: readonly ChannelHistoryEntry[] }>();

const DAY_MS = 86_400_000;
const dayOf = dayKeyFormatter();

const VIEW: Record<HistoryKind, { icon: Component; node: string; chip: string }> = {
  deliver: {
    icon: Rocket,
    node: "bg-primary/10 text-primary ring-primary/25",
    chip: "border-primary/30 text-foreground",
  },
  rollback: {
    icon: History,
    node: "bg-warning-soft text-warning ring-warning/30",
    chip: "border-warning/40 text-foreground",
  },
  clear: {
    icon: CircleX,
    node: "bg-muted text-muted-foreground ring-border",
    chip: "text-muted-foreground",
  },
  pause: {
    icon: CirclePause,
    node: "bg-danger-soft text-destructive ring-destructive/25",
    chip: "text-muted-foreground",
  },
  resume: {
    icon: CirclePlay,
    node: "bg-info-soft text-info ring-info/25",
    chip: "text-muted-foreground",
  },
};

const clock = useNow();
onScopeDispose(clock.release);

const days = computed(() => groupHistory(props.entries, dayOf));
const today = computed(() => dayOf(new Date(clock.now.value).toISOString()));
const yesterday = computed(() => dayOf(new Date(clock.now.value - DAY_MS).toISOString()));
const moves = (entry: ChannelHistoryEntry) => Boolean(entry.from_version || entry.to_version);
</script>

<template>
  <div class="space-y-5">
    <section
      v-for="day in days"
      :key="day.day"
      class="[contain-intrinsic-size:auto_320px] [content-visibility:auto]"
    >
      <h3
        class="text-muted-foreground mb-2 flex items-center gap-2 text-[11px] font-medium tracking-wide uppercase"
      >
        {{ dayLabel(day.day, today, yesterday) }}
        <span class="bg-border h-px flex-1" aria-hidden="true" />
      </h3>
      <ol class="relative">
        <span class="bg-border absolute top-4 bottom-4 left-3.5 w-px" aria-hidden="true" />
        <li
          v-for="entry in day.entries"
          :key="entry.id"
          class="relative flex gap-3 py-1.5 first:pt-0 last:pb-0"
        >
          <span
            :class="
              cn(
                'relative z-10 grid size-7 shrink-0 place-items-center rounded-full ring-1 ring-inset',
                VIEW[historyKind(entry.action)].node,
              )
            "
            aria-hidden="true"
          >
            <component :is="VIEW[historyKind(entry.action)].icon" class="size-3.5" />
          </span>
          <div class="min-w-0 flex-1 space-y-1 pt-0.5">
            <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span class="font-medium">{{ historyLabel(entry.action) }}</span>
              <span v-if="moves(entry)" class="flex items-center gap-1 font-mono text-[11px]">
                <span class="text-muted-foreground rounded border px-1 py-px">{{
                  entry.from_version ?? "none"
                }}</span>
                <ArrowRight class="text-muted-foreground size-3" />
                <span
                  :class="cn('rounded border px-1 py-px', VIEW[historyKind(entry.action)].chip)"
                  >{{ entry.to_version ?? "none" }}</span
                >
              </span>
              <RelativeTime
                :value="entry.created_at"
                class="text-muted-foreground ml-auto text-xs"
              />
            </div>
            <p class="text-muted-foreground truncate text-xs">by {{ historyActor(entry) }}</p>
            <blockquote
              v-if="entry.reason"
              class="border-border text-foreground/90 border-l-2 pl-2.5 text-xs text-pretty italic"
            >
              {{ entry.reason }}
            </blockquote>
          </div>
        </li>
      </ol>
    </section>
  </div>
</template>
