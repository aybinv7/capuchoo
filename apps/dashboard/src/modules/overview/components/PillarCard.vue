<script setup lang="ts">
import type { Component } from "vue";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface PillarMetric {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning" | "danger";
}

const props = withDefaults(
  defineProps<{
    title: string;
    icon: Component;
    headline: string;
    headlineLabel: string;
    tone?: "default" | "success" | "warning" | "danger";
    metrics: readonly PillarMetric[];
    loading?: boolean;
  }>(),
  { tone: "default", loading: false },
);

const TONE = {
  default: "",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
} as const;
</script>

<template>
  <section class="bg-card flex min-w-0 flex-col rounded-lg border">
    <header class="flex items-center justify-between gap-3 border-b px-4 py-2.5">
      <h2 class="flex items-center gap-2 text-sm font-medium">
        <component :is="props.icon" class="text-muted-foreground size-4" aria-hidden="true" />
        {{ props.title }}
      </h2>
      <div class="flex items-center gap-1">
        <slot name="links" />
      </div>
    </header>
    <div
      v-if="props.loading"
      class="grid gap-4 p-4 lg:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]"
      aria-busy="true"
    >
      <div class="space-y-3">
        <Skeleton class="h-10 w-32" />
        <Skeleton class="h-14 w-full" />
      </div>
      <Skeleton class="h-36 w-full" />
    </div>
    <div v-else class="grid flex-1 gap-5 p-4 lg:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]">
      <div class="flex min-w-0 flex-col gap-4">
        <div>
          <div
            :class="
              cn(
                'tabular font-mono text-4xl leading-none font-semibold tracking-tight',
                TONE[props.tone],
              )
            "
          >
            {{ props.headline }}
          </div>
          <div class="text-muted-foreground mt-1.5 text-xs">{{ props.headlineLabel }}</div>
        </div>
        <dl class="mt-auto grid grid-cols-3 gap-2 border-t pt-3">
          <div v-for="metric in props.metrics" :key="metric.label" class="min-w-0">
            <dt class="text-muted-foreground truncate text-[11px]">{{ metric.label }}</dt>
            <dd
              :class="
                cn(
                  'tabular truncate font-mono text-sm font-semibold',
                  TONE[metric.tone ?? 'default'],
                )
              "
            >
              {{ metric.value }}
            </dd>
          </div>
        </dl>
      </div>
      <div class="min-w-0">
        <slot name="chart" />
      </div>
    </div>
    <slot name="empty" />
  </section>
</template>
