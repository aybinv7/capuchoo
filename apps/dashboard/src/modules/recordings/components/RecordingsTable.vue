<script setup lang="ts">
import { TriangleAlert } from "@lucide/vue";
import { RouterLink } from "vue-router";
import { DataTable } from "@/shared/components/data-table";
import PlatformIcon from "@/shared/components/PlatformIcon.vue";
import RelativeTime from "@/shared/components/RelativeTime.vue";
import StatusDot from "@/shared/components/StatusDot.vue";
import VersionTag from "@/shared/components/VersionTag.vue";
import { formatBytes, formatDateTime } from "@/shared/lib/format";
import { RouteName } from "@/shared/router/route-names";
import { formatOffset } from "../lib/activity";
import { RECORDING_COLUMNS, sessionDeviceLabel } from "../lib/recording-columns";
import type { RecordingSession } from "../types/recordings.types";
import StartBadge from "@/shared/components/recording/StartBadge.vue";

const search = defineModel<string>("search", { required: true });

const props = defineProps<{
  sessions: readonly RecordingSession[];
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  refreshing: boolean;
  appName: string;
}>();
const emit = defineEmits<{ open: [session: RecordingSession]; loadMore: []; refresh: [] }>();
</script>

<template>
  <DataTable
    v-model:search="search"
    :data="props.sessions"
    :columns="RECORDING_COLUMNS"
    :get-row-id="(session) => session.id"
    table-id="recordings"
    :export-name="`${props.appName}-recordings`"
    :features="{ grouping: true }"
    search-placeholder="Filter loaded sessions by device, note or version"
    :has-more="props.hasMore"
    :loading="props.loading"
    :loading-more="props.loadingMore"
    refreshable
    :refreshing="props.refreshing"
    row-clickable
    @row-click="emit('open', $event)"
    @load-more="emit('loadMore')"
    @refresh="emit('refresh')"
  >
    <template #toolbar>
      <slot name="toolbar" />
    </template>
    <template #cell-started="{ row }">
      <div class="flex items-center gap-2">
        <StatusDot v-if="row.live" tone="danger" pulse />
        <div class="min-w-0">
          <RouterLink
            :to="{ name: RouteName.recording, params: { recordingId: row.id } }"
            class="text-sm underline-offset-2 hover:underline"
            :title="formatDateTime(row.started_at)"
          >
            <RelativeTime :value="row.started_at" />
          </RouterLink>
          <div v-if="row.live" class="text-destructive text-[11px] font-medium">Live now</div>
        </div>
      </div>
    </template>
    <template #cell-device="{ row }">
      <div class="flex min-w-0 items-center gap-2">
        <PlatformIcon :platform="row.platform" class="text-muted-foreground size-4 shrink-0" />
        <div class="min-w-0">
          <div class="truncate text-sm">{{ sessionDeviceLabel(row) }}</div>
          <div class="text-muted-foreground truncate font-mono text-[11px]" :title="row.device_id">
            {{ row.device_id }}
          </div>
        </div>
      </div>
    </template>
    <template #cell-start="{ row }">
      <StartBadge :start="row.start" />
    </template>
    <template #cell-version="{ row }">
      <VersionTag kind="ota" :version="row.version_name" />
    </template>
    <template #cell-channel="{ row }">
      <span class="font-mono text-xs">{{ row.channel ?? "—" }}</span>
    </template>
    <template #cell-duration="{ row }">
      <span class="tabular font-mono text-xs">{{ formatOffset(row.duration_ms) }}</span>
    </template>
    <template #cell-errors="{ row }">
      <span
        v-if="row.error_count > 0"
        class="text-destructive inline-flex items-center gap-1 font-mono text-xs"
      >
        <TriangleAlert class="size-3" aria-hidden="true" />{{ row.error_count }}
      </span>
      <span v-else class="text-muted-foreground text-xs">—</span>
    </template>
    <template #cell-size="{ row }">
      <span class="tabular text-muted-foreground text-xs">{{ formatBytes(row.size_bytes) }}</span>
    </template>
    <template #cell-note="{ row }">
      <span v-if="row.note" class="line-clamp-2 text-xs text-pretty" :title="row.note">{{
        row.note
      }}</span>
      <span v-else class="text-muted-foreground text-xs">—</span>
    </template>
    <template #empty>
      <slot name="empty" />
    </template>
  </DataTable>
</template>
