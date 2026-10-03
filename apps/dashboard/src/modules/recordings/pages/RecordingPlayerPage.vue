<script setup lang="ts">
import { Clapperboard } from "@lucide/vue";
import { useEventListener } from "@vueuse/core";
import { useQueryClient } from "@tanstack/vue-query";
import { computed, ref, useTemplateRef, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { Skeleton } from "@/components/ui/skeleton";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { isApiError } from "@/shared/api/errors";
import { queryKeys } from "@/shared/api/query-keys";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import { useCurrentApp } from "@/shared/composables/useCurrentApp";
import { useBreadcrumbLabel } from "@/shared/layouts/composables/useBreadcrumbLabel";
import { RouteName } from "@/shared/router/route-names";
import InspectorPanel from "../components/inspector/InspectorPanel.vue";
import ReplayStage from "../components/player/ReplayStage.vue";
import ScrubberTimeline from "../components/player/ScrubberTimeline.vue";
import SessionHeader from "../components/player/SessionHeader.vue";
import TransportBar from "../components/player/TransportBar.vue";
import { useAssetMap } from "../composables/useAssetMap";
import { useRecording } from "../composables/useRecording";
import { useRecordingEvents } from "../composables/useRecordingEvents";
import { useReplayer, useReplayerDisposal } from "../composables/useReplayer";
import { sessionDeviceLabel } from "../lib/recording-columns";
import { buildTimeline, sessionBounds, timelineMarkers } from "../lib/timeline";
import { deleteRecording } from "../services/recordings.service";

const LIVE_LAG_MS = 2500;

const route = useRoute();
const router = useRouter();
const client = useQueryClient();
const { appId } = useCurrentApp();

const recordingId = computed(() =>
  typeof route.params.recordingId === "string" ? route.params.recordingId : "",
);
const detail = useRecording(appId, recordingId);
const session = computed(() => detail.data.value?.session ?? null);
const segments = computed(() => detail.data.value?.segments);
const assets = computed(() => detail.data.value?.assets);
const missing = computed(() => isApiError(detail.error.value) && detail.error.value.status === 404);
useBreadcrumbLabel(computed(() => (session.value ? sessionDeviceLabel(session.value) : null)));

const stageView = useTemplateRef<InstanceType<typeof ReplayStage>>("stageView");
const player = useReplayer({
  root: computed(() => stageView.value?.root ?? null),
  stage: computed(() => stageView.value?.stage ?? null),
});
useReplayerDisposal(player);

const assetMap = useAssetMap(assets);
const events = useRecordingEvents({
  recordingId,
  segments,
  assets: assetMap.map,
  assetsReady: assetMap.ready,
  onReplay: (replay) => player.push(replay),
});

const hasScreen = computed(() => segments.value?.some((segment) => segment.full_snapshot) ?? false);
const bounds = computed(() => {
  const current = session.value;
  if (!current) return { start: 0, end: 1000 };
  return sessionBounds(
    events.lanes.value,
    Date.parse(current.started_at),
    Date.parse(current.ended_at),
  );
});
const duration = computed(() => bounds.value.end - bounds.value.start);
watch(bounds, (value) => player.setTimeline(value.start, value.end - value.start), {
  immediate: true,
});

const tracks = computed(() => buildTimeline(events.lanes.value, bounds.value));
const markers = computed(() => timelineMarkers(events.lanes.value, bounds.value));
const playhead = computed(() => bounds.value.start + player.time.value);
const loadedRatio = computed(() =>
  events.total.value === 0 ? 1 : events.loaded.value / events.total.value,
);

const followList = ref(true);
const followLive = ref(false);
const live = computed(() => session.value?.live ?? false);

watch(recordingId, () => {
  player.destroy();
  followLive.value = false;
});

watch(live, (value, previous) => {
  if (value && !previous) followLive.value = true;
  if (!value) followLive.value = false;
});

watch(duration, (length) => {
  if (!followLive.value) return;
  if (player.time.value < length - LIVE_LAG_MS * 2) player.seek(length - LIVE_LAG_MS);
  if (!player.playing.value) player.play();
});

function toggle() {
  if (player.playing.value) player.pause();
  else player.play();
}

function seekWall(time: number) {
  followLive.value = false;
  player.seek(time - bounds.value.start);
}

function seekOffset(ms: number) {
  followLive.value = false;
  player.seek(ms);
}

function jumpLive() {
  followLive.value = true;
  player.seek(duration.value - LIVE_LAG_MS);
  player.play();
}

useEventListener(window, "keydown", (event: KeyboardEvent) => {
  const target = event.target as HTMLElement | null;
  if (target?.closest("input, textarea, select, [contenteditable], [role=slider]")) return;
  if (event.code === "Space") {
    event.preventDefault();
    toggle();
  }
});

const removeOpen = ref(false);
const removing = ref(false);
const removeError = ref<unknown>(null);

async function remove() {
  if (!session.value) return;
  removing.value = true;
  removeError.value = null;
  try {
    await deleteRecording(session.value.id);
    await client.invalidateQueries({ queryKey: queryKeys.recordingsAll(appId.value) });
    removeOpen.value = false;
    void router.replace({ name: RouteName.recordings });
  } catch (error) {
    removeError.value = error;
  } finally {
    removing.value = false;
  }
}
</script>

<template>
  <div class="flex h-[calc(100svh-4rem)] min-h-[600px] flex-col gap-3 px-4 pt-4 pb-3 md:px-6">
    <EmptyState
      v-if="missing"
      :icon="Clapperboard"
      title="This recording is not here"
      description="It expired, was deleted, or belongs to an app you cannot see."
    >
      <RouterLink
        :to="{ name: RouteName.recordings }"
        class="text-primary text-sm underline-offset-4 hover:underline"
        >Back to recordings</RouterLink
      >
    </EmptyState>
    <ErrorNotice
      v-else-if="detail.error.value && !session"
      :error="detail.error.value"
      :retry="detail.refetch"
    />
    <div v-else-if="!session" class="flex flex-1 flex-col gap-3" aria-busy="true">
      <Skeleton class="h-12 w-96 max-w-full" />
      <Skeleton class="min-h-0 flex-1" />
      <Skeleton class="h-24" />
    </div>
    <template v-else>
      <SessionHeader :session="session" @remove="removeOpen = true" />

      <ResizablePanelGroup
        direction="horizontal"
        auto-save-id="recording-player"
        class="min-h-0 flex-1 overflow-hidden rounded-xl border"
      >
        <ResizablePanel :default-size="62" :min-size="35">
          <ReplayStage
            ref="stageView"
            :state="player.state.value"
            :viewport="player.viewport.value"
            :scale="player.scale.value"
            :has-screen="hasScreen"
            :loaded="events.loaded.value"
            :total="events.total.value"
            :live="live && followLive"
          />
        </ResizablePanel>
        <ResizableHandle with-handle />
        <ResizablePanel :default-size="38" :min-size="24">
          <InspectorPanel
            v-model:follow="followList"
            :lanes="events.lanes.value"
            :playhead="playhead"
            :origin="bounds.start"
            @seek="seekWall"
          />
        </ResizablePanel>
      </ResizablePanelGroup>

      <section class="bg-card space-y-2 rounded-xl border px-3 pt-2 pb-3" aria-label="Playback">
        <TransportBar
          :playing="player.playing.value"
          :time="player.time.value"
          :duration="duration"
          :speed="player.speed.value"
          :skip-inactive="player.skipInactive.value"
          :live="live"
          :following="followLive"
          @toggle="toggle"
          @seek="seekOffset"
          @speed="player.setSpeed"
          @skip-inactive="player.setSkipInactive"
          @follow="jumpLive"
        />
        <ScrubberTimeline
          :tracks="tracks"
          :markers="markers"
          :duration="duration"
          :time="player.time.value"
          :loaded="loadedRatio"
          @seek="seekOffset"
        />
      </section>

      <ConfirmDialog
        v-model:open="removeOpen"
        title="Delete this recording?"
        description="Its segments are removed from storage. Sessions expire on their own after the retention period."
        confirm-label="Delete"
        destructive
        :pending="removing"
        :error="removeError"
        @confirm="remove"
      />
    </template>
  </div>
</template>
