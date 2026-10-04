<script setup lang="ts">
import {
  Activity,
  ChevronRight,
  CircleCheck,
  HardDriveDownload,
  Package,
  RadioTower,
  RotateCcw,
  ShieldAlert,
  type LucideIcon,
} from "@lucide/vue";
import { RouterLink } from "vue-router";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { AttentionItem } from "../lib/attention";

const props = defineProps<{ items: readonly AttentionItem[]; loading?: boolean }>();

const KIND: Record<AttentionItem["kind"], { label: string; icon: LucideIcon }> = {
  regression: { label: "Regression", icon: RotateCcw },
  release: { label: "Release", icon: Package },
  errors: { label: "New errors", icon: ShieldAlert },
  delivery: { label: "Delivery", icon: RadioTower },
  recorder: { label: "Recorder", icon: HardDriveDownload },
  live: { label: "Live", icon: Activity },
};

const STRIPE = { danger: "bg-destructive", warning: "bg-warning", info: "bg-info" } as const;
const TEXT = { danger: "text-destructive", warning: "text-warning", info: "text-info" } as const;
</script>

<template>
  <section class="bg-card rounded-lg border">
    <header class="flex items-center justify-between border-b px-4 py-2.5">
      <h2 class="text-sm font-medium">Needs attention</h2>
      <span v-if="props.items.length" class="text-muted-foreground tabular text-xs">
        {{ props.items.length }}
      </span>
    </header>
    <div v-if="props.loading" class="space-y-2 p-3" aria-busy="true">
      <Skeleton v-for="index in 3" :key="index" class="h-12 w-full" />
    </div>
    <p
      v-else-if="props.items.length === 0"
      class="text-muted-foreground flex items-center gap-2 px-4 py-5 text-sm"
    >
      <CircleCheck class="text-success size-4" />
      Nothing needs you right now: no regression, no failing channel, no recorder in trouble.
    </p>
    <ul v-else class="divide-y">
      <li v-for="item in props.items" :key="item.id">
        <RouterLink
          :to="item.to"
          class="group hover:bg-accent/40 relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-2.5 pr-3 pl-5"
        >
          <span
            :class="cn('absolute inset-y-2 left-0 w-0.5 rounded-full', STRIPE[item.tone])"
            aria-hidden="true"
          />
          <span
            :class="
              cn(
                'flex w-24 items-center gap-1.5 text-[11px] font-medium whitespace-nowrap',
                TEXT[item.tone],
              )
            "
          >
            <component :is="KIND[item.kind].icon" class="size-3.5" aria-hidden="true" />
            {{ KIND[item.kind].label }}
          </span>
          <span class="min-w-0">
            <span
              :class="
                cn(
                  'block truncate text-sm font-medium',
                  item.kind === 'regression' && 'font-mono text-xs',
                )
              "
              >{{ item.title }}</span
            >
            <span class="text-muted-foreground block truncate text-xs">{{ item.detail }}</span>
          </span>
          <ChevronRight
            class="text-muted-foreground size-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </RouterLink>
      </li>
    </ul>
  </section>
</template>
