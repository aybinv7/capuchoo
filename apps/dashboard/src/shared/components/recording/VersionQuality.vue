<script setup lang="ts">
import { RouterLink } from "vue-router";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatCount, formatPercent } from "@/shared/lib/format";
import { errorRate, type VersionSpike } from "@/shared/recording/quality";
import { RouteName } from "@/shared/router/route-names";
import type { VersionQuality } from "@/shared/types/recording-stats";

const props = defineProps<{
  versions: readonly VersionQuality[];
  spike?: VersionSpike | null;
  loading?: boolean;
}>();

const width = (row: VersionQuality) => `${Math.max(2, (errorRate(row) ?? 0) * 100)}%`;
</script>

<template>
  <div v-if="props.loading" class="space-y-2" aria-busy="true">
    <Skeleton v-for="index in 4" :key="index" class="h-8 w-full" />
  </div>
  <p v-else-if="props.versions.length === 0" class="text-muted-foreground py-6 text-sm">
    No version has recorded a session yet.
  </p>
  <ol v-else class="-mx-2">
    <li v-for="(row, index) in props.versions" :key="row.version">
      <RouterLink
        :to="{ name: RouteName.recordings, query: { version: row.version } }"
        class="hover:bg-accent/50 block space-y-1 rounded-md px-2 py-1.5"
        :title="`${row.error_sessions} of ${row.sessions} sessions on ${row.version} saw an error`"
      >
        <span class="flex items-center gap-2 text-xs">
          <span class="truncate font-mono">{{ row.version }}</span>
          <span
            v-if="index === 0"
            class="bg-primary/10 text-primary shrink-0 rounded px-1 text-[10px] font-medium"
            >newest</span
          >
          <span class="text-muted-foreground tabular ml-auto shrink-0 text-[11px]"
            >{{ formatCount(row.sessions) }} sessions</span
          >
          <span
            :class="
              cn(
                'tabular w-12 shrink-0 text-right font-medium',
                props.spike?.version === row.version && 'text-destructive',
              )
            "
            >{{ formatPercent(errorRate(row)) }}</span
          >
        </span>
        <span class="bg-muted block h-1.5 overflow-hidden rounded-full" aria-hidden="true">
          <span
            :class="
              cn(
                'block h-full rounded-full',
                props.spike?.version === row.version ? 'bg-destructive' : 'bg-warning',
              )
            "
            :style="{ width: width(row) }"
          />
        </span>
      </RouterLink>
    </li>
  </ol>
</template>
