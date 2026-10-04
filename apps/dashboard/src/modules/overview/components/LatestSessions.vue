<script setup lang="ts">
import { Bug, Clapperboard } from "@lucide/vue";
import { RouterLink } from "vue-router";
import { Skeleton } from "@/components/ui/skeleton";
import RelativeTime from "@/shared/components/RelativeTime.vue";
import StatusDot from "@/shared/components/StatusDot.vue";
import StartBadge from "@/shared/components/recording/StartBadge.vue";
import { formatSpan } from "@/shared/lib/format";
import { RouteName } from "@/shared/router/route-names";
import type { SessionSummary } from "@/shared/types/recording-stats";

const props = defineProps<{ sessions: readonly SessionSummary[]; loading?: boolean }>();

function deviceLabel(session: SessionSummary): string {
  const hardware = [session.device?.manufacturer, session.device?.model].filter(Boolean).join(" ");
  return hardware || session.device_id;
}
</script>

<template>
  <div v-if="props.loading" class="space-y-2" aria-busy="true">
    <Skeleton v-for="index in 5" :key="index" class="h-11 w-full" />
  </div>
  <div
    v-else-if="props.sessions.length === 0"
    class="text-muted-foreground flex items-center gap-2 py-6 text-sm"
  >
    <Clapperboard class="size-4" />
    No session recorded yet.
  </div>
  <ol v-else class="-mx-2">
    <li v-for="session in props.sessions" :key="session.id">
      <RouterLink
        :to="{ name: RouteName.recording, params: { recordingId: session.id } }"
        class="hover:bg-accent/50 grid grid-cols-[6.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 py-2"
      >
        <StartBadge :start="session.start" class="justify-self-start" />
        <span class="min-w-0">
          <span class="flex min-w-0 items-center gap-2 text-sm">
            <StatusDot v-if="session.live" tone="danger" pulse />
            <span class="truncate">{{ session.note ?? deviceLabel(session) }}</span>
          </span>
          <span class="text-muted-foreground block truncate text-[11px]">
            <template v-if="session.note">{{ deviceLabel(session) }} · </template>
            <span class="font-mono">{{ session.version_name }}</span>
            <template v-if="session.channel"> · {{ session.channel }}</template>
          </span>
        </span>
        <span class="flex items-center gap-3 text-xs">
          <span
            v-if="session.error_count > 0"
            class="text-destructive tabular flex items-center gap-1"
            :title="`${session.error_count} errors`"
          >
            <Bug class="size-3.5" />{{ session.error_count }}
          </span>
          <span class="tabular text-muted-foreground w-14 text-right font-mono">{{
            formatSpan(session.duration_ms)
          }}</span>
          <RelativeTime
            :value="session.started_at"
            class="text-muted-foreground w-16 text-right text-[11px]"
          />
        </span>
      </RouterLink>
    </li>
  </ol>
</template>
