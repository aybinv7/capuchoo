<script setup lang="ts">
import { Radio } from "@lucide/vue";
import { RouterLink } from "vue-router";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatBytes, formatCount, formatSpan } from "@/shared/lib/format";
import { RouteName } from "@/shared/router/route-names";
import type { RecordingStats } from "@/shared/types/recording-stats";

const props = defineProps<{ stats: RecordingStats | null | undefined; loading?: boolean }>();

const share = (part: number, total: number) => `${total > 0 ? (part / total) * 100 : 0}%`;
</script>

<template>
  <div v-if="props.loading || !props.stats" class="space-y-3" aria-busy="true">
    <Skeleton class="h-10 w-full" />
    <Skeleton class="h-24 w-full" />
  </div>
  <div v-else class="flex h-full flex-col gap-4">
    <div>
      <div class="flex items-baseline justify-between gap-2">
        <span class="tabular font-mono text-2xl font-semibold">
          {{ formatCount(props.stats.recorders.online) }}
          <span class="text-muted-foreground text-base font-normal"
            >/ {{ formatCount(props.stats.recorders.total) }}</span
          >
        </span>
        <span class="text-muted-foreground text-xs">recorders online</span>
      </div>
      <div class="bg-muted mt-2 flex h-1.5 overflow-hidden rounded-full" aria-hidden="true">
        <span
          class="bg-success h-full"
          :style="{
            width: share(
              props.stats.recorders.online - props.stats.recorders.degraded,
              props.stats.recorders.total,
            ),
          }"
        />
        <span
          class="bg-warning h-full"
          :style="{ width: share(props.stats.recorders.degraded, props.stats.recorders.total) }"
        />
      </div>
    </div>
    <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
      <dt class="text-muted-foreground">Dropping recordings</dt>
      <dd
        :class="
          cn('tabular text-right font-mono', props.stats.recorders.degraded > 0 && 'text-warning')
        "
      >
        {{ formatCount(props.stats.recorders.degraded) }}
      </dd>
      <dt class="text-muted-foreground">Kept live by a rule</dt>
      <dd class="tabular text-right font-mono">
        {{ formatCount(props.stats.recorders.live_rules) }}
      </dd>
      <dt class="text-muted-foreground">Average session</dt>
      <dd class="tabular text-right font-mono">
        {{ formatSpan(props.stats.totals.avg_duration_ms) }}
      </dd>
      <dt class="text-muted-foreground">Stored, {{ props.stats.days }} days</dt>
      <dd class="tabular text-right font-mono">{{ formatBytes(props.stats.totals.bytes) }}</dd>
    </dl>
    <div class="mt-auto flex flex-wrap gap-2">
      <Button variant="outline" size="sm" as-child>
        <RouterLink :to="{ name: RouteName.recordingRules }">
          <Radio />
          What devices record
        </RouterLink>
      </Button>
      <Button variant="ghost" size="sm" as-child>
        <RouterLink :to="{ name: RouteName.recordingSetup }">Health</RouterLink>
      </Button>
    </div>
  </div>
</template>
