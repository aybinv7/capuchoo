<script setup lang="ts">
import { CircleCheck } from "@lucide/vue";
import { RouterLink } from "vue-router";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import StatusDot from "@/shared/components/StatusDot.vue";
import RelativeTime from "@/shared/components/RelativeTime.vue";
import { formatCount } from "@/shared/lib/format";
import { RouteName } from "@/shared/router/route-names";
import type { IssueSummary } from "@/shared/types/recording-stats";

const props = defineProps<{ issues: readonly IssueSummary[]; loading?: boolean; days: number }>();
</script>

<template>
  <div v-if="props.loading" class="space-y-2" aria-busy="true">
    <Skeleton v-for="index in 4" :key="index" class="h-11 w-full" />
  </div>
  <div
    v-else-if="props.issues.length === 0"
    class="text-muted-foreground flex items-center gap-2 py-6 text-sm"
  >
    <CircleCheck class="text-success size-4" />
    No unresolved error in the last {{ props.days }} days.
  </div>
  <ol v-else class="-mx-2">
    <li v-for="issue in props.issues" :key="issue.id">
      <RouterLink
        :to="{ name: RouteName.recordingIssues }"
        class="hover:bg-accent/50 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 py-2"
      >
        <StatusDot tone="danger" />
        <span class="min-w-0">
          <span class="flex min-w-0 items-center gap-2">
            <span class="truncate font-mono text-xs font-semibold">{{ issue.message }}</span>
            <Badge
              v-if="issue.status === 'regressed'"
              variant="destructive"
              class="h-4 shrink-0 px-1.5 text-[10px]"
              >Regressed</Badge
            >
          </span>
          <span class="text-muted-foreground block truncate text-[11px]">
            <template v-if="issue.frame">{{ issue.frame }} · </template>
            <RelativeTime :value="issue.last_seen" />
          </span>
        </span>
        <span class="text-right text-xs leading-tight">
          <span class="tabular block font-medium">{{ formatCount(issue.sessions) }} sessions</span>
          <span class="text-muted-foreground tabular block text-[11px]"
            >{{ formatCount(issue.devices) }} devices</span
          >
        </span>
      </RouterLink>
    </li>
  </ol>
</template>
