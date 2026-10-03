<script setup lang="ts">
import { ChevronRight, Play } from "@lucide/vue";
import { useQuery } from "@tanstack/vue-query";
import { computed, ref } from "vue";
import { RouterLink } from "vue-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { queryKeys } from "@/shared/api/query-keys";
import RelativeTime from "@/shared/components/RelativeTime.vue";
import StatusDot from "@/shared/components/StatusDot.vue";
import { RouteName } from "@/shared/router/route-names";
import { formatOffset } from "../../lib/activity";
import { fetchIssueSessions } from "../../services/recordings.service";
import type { IssueSession, RecordingIssueRow } from "../../types/recordings.types";
import StartBadge from "../StartBadge.vue";
import IssueFrame from "./IssueFrame.vue";

const props = defineProps<{ issue: RecordingIssueRow; appId: string; pending: boolean }>();
const emit = defineEmits<{ status: [status: "open" | "resolved"] }>();

const open = ref(false);
const sessions = useQuery({
  queryKey: computed(() => queryKeys.recordingIssueSessions(props.appId, props.issue.id)),
  queryFn: ({ signal }) => fetchIssueSessions(props.issue.id, signal),
  enabled: open,
});

const LEAD_MS = 1500;

function deviceLabel(session: IssueSession): string {
  const hardware = [session.device?.manufacturer, session.device?.model].filter(Boolean).join(" ");
  return hardware || session.device_id;
}

const versions = computed(() =>
  props.issue.first_version === props.issue.last_version
    ? props.issue.last_version
    : `${props.issue.first_version} → ${props.issue.last_version}`,
);
</script>

<template>
  <li class="border-b last:border-b-0">
    <div
      class="hover:bg-accent/40 grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 px-3 py-3 md:grid-cols-[auto_minmax(0,1fr)_repeat(3,5.5rem)_7rem_auto] md:items-center"
    >
      <button
        type="button"
        class="text-muted-foreground hover:text-foreground mt-0.5 md:mt-0"
        :aria-expanded="open"
        :aria-label="open ? 'Hide sessions' : 'Show sessions'"
        @click="open = !open"
      >
        <ChevronRight :class="cn('size-4 transition-transform', open && 'rotate-90')" />
      </button>

      <button type="button" class="min-w-0 space-y-1 text-left" @click="open = !open">
        <p class="flex items-center gap-2">
          <StatusDot :tone="props.issue.status === 'resolved' ? 'muted' : 'danger'" />
          <span class="line-clamp-2 font-mono text-xs font-semibold break-words">{{
            props.issue.message
          }}</span>
          <Badge
            v-if="props.issue.status === 'regressed'"
            variant="destructive"
            class="h-4 px-1.5 text-[10px]"
            >Regressed</Badge
          >
        </p>
        <IssueFrame
          v-if="props.issue.frame"
          :app-id="props.appId"
          :version="props.issue.last_version"
          :frame="props.issue.frame"
        />
        <p class="text-muted-foreground flex flex-wrap gap-x-3 text-[11px] md:hidden">
          <span>{{ props.issue.occurrences }} times</span>
          <span>{{ props.issue.devices }} devices</span>
          <span>{{ versions }}</span>
          <span><RelativeTime :value="props.issue.last_seen" /></span>
        </p>
      </button>

      <span class="tabular hidden text-right text-sm font-semibold md:block">{{
        props.issue.occurrences
      }}</span>
      <span class="tabular hidden text-right text-sm md:block">{{ props.issue.devices }}</span>
      <span
        class="tabular hidden truncate text-right font-mono text-[11px] md:block"
        :title="versions"
        >{{ versions }}</span
      >
      <span class="text-muted-foreground hidden text-right text-xs md:block">
        <RelativeTime :value="props.issue.last_seen" />
      </span>

      <Button
        variant="outline"
        size="sm"
        class="h-7 text-xs"
        :disabled="props.pending"
        @click="emit('status', props.issue.status === 'resolved' ? 'open' : 'resolved')"
      >
        {{ props.issue.status === "resolved" ? "Reopen" : "Resolve" }}
      </Button>
    </div>

    <div v-if="open" class="bg-muted/30 border-t px-3 py-2 md:pl-10">
      <div v-if="sessions.isPending.value" class="space-y-2 py-1">
        <Skeleton class="h-8" />
        <Skeleton class="h-8" />
      </div>
      <p v-else-if="!sessions.data.value?.length" class="text-muted-foreground py-2 text-xs">
        The sessions it happened in have expired.
      </p>
      <ol v-else class="divide-border/60 divide-y">
        <li
          v-for="session in sessions.data.value"
          :key="session.id"
          class="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-xs"
        >
          <span class="min-w-0 flex-1 truncate font-medium">{{ deviceLabel(session) }}</span>
          <StartBadge :start="session.start" />
          <span class="font-mono text-[11px]">{{ session.version_name }}</span>
          <span v-if="session.occurrences > 1" class="text-muted-foreground tabular"
            >×{{ session.occurrences }}</span
          >
          <span class="text-muted-foreground"><RelativeTime :value="session.started_at" /></span>
          <Button variant="ghost" size="sm" class="h-7 text-xs" as-child>
            <RouterLink
              :to="{
                name: RouteName.recording,
                params: { recordingId: session.id },
                query: { t: String(Math.max(0, session.offset_ms - LEAD_MS)) },
              }"
            >
              <Play class="size-3" />
              Replay at {{ formatOffset(session.offset_ms) }}
            </RouterLink>
          </Button>
          <p
            v-if="session.note"
            class="text-muted-foreground w-full truncate text-[11px]"
            dir="auto"
          >
            “{{ session.note }}”
          </p>
        </li>
      </ol>
    </div>
  </li>
</template>
