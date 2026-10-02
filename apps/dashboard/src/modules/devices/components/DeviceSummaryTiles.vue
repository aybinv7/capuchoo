<script setup lang="ts">
import { Skeleton } from "@/components/ui/skeleton";
import RelativeTime from "@/shared/components/RelativeTime.vue";
import StatTile from "@/shared/components/StatTile.vue";
import { formatCount } from "@/shared/lib/format";
import { actionLabel } from "../lib/event-labels";
import type { DeviceSummary } from "../types/devices.types";

const props = defineProps<{ summary: DeviceSummary | null }>();
</script>

<template>
  <div
    v-if="!props.summary"
    class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5"
    aria-busy="true"
  >
    <Skeleton v-for="index in 5" :key="index" class="h-[84px]" />
  </div>
  <div v-else class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
    <StatTile
      label="Update checks"
      :value="formatCount(props.summary.checks)"
      :hint="`last ${props.summary.days} days`"
    />
    <StatTile
      label="Delivered"
      :value="formatCount(props.summary.delivered)"
      :tone="props.summary.delivered ? 'success' : 'default'"
      :hint="`last ${props.summary.days} days`"
    />
    <StatTile
      label="Failed"
      :value="formatCount(props.summary.failed)"
      :tone="props.summary.failed ? 'danger' : 'default'"
      :hint="`last ${props.summary.days} days`"
    />
    <StatTile
      label="Last delivery"
      :value="
        props.summary.last_delivered?.version ??
        (props.summary.last_delivered ? 'unknown version' : 'none')
      "
      textual
    >
      <template v-if="props.summary.last_delivered" #hint>
        <RelativeTime :value="props.summary.last_delivered.at" />
      </template>
    </StatTile>
    <StatTile
      label="Last failure"
      :value="props.summary.last_failure ? actionLabel(props.summary.last_failure.action) : 'none'"
      :tone="props.summary.last_failure ? 'danger' : 'default'"
      textual
    >
      <template v-if="props.summary.last_failure" #hint>
        <span :title="props.summary.last_failure.error ?? undefined">
          <RelativeTime :value="props.summary.last_failure.at" />
          <template v-if="props.summary.last_failure.error">
            · <span class="font-mono">{{ props.summary.last_failure.error }}</span>
          </template>
        </span>
      </template>
    </StatTile>
  </div>
</template>
