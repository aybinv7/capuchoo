<script setup lang="ts">
import { Clapperboard } from "@lucide/vue";
import { useClipboard, useStorage } from "@vueuse/core";
import { useQueryClient } from "@tanstack/vue-query";
import { computed, ref, useTemplateRef, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { toast } from "vue-sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { isApiError } from "@/shared/api/errors";
import { queryKeys } from "@/shared/api/query-keys";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import { useCurrentApp } from "@/shared/composables/useCurrentApp";
import { useBreadcrumbLabel } from "@/shared/layouts/composables/useBreadcrumbLabel";
import { RouteName } from "@/shared/router/route-names";
import ExportTestDialog from "../components/export/ExportTestDialog.vue";
import InspectorPanel from "../components/inspector/InspectorPanel.vue";
import ReplayStage from "../components/player/ReplayStage.vue";
import InspectorToggle from "../components/player/InspectorToggle.vue";
import PlaybackDock from "../components/player/PlaybackDock.vue";
import PlayerToolbar from "../components/player/PlayerToolbar.vue";
import { isInspectorTab, type InspectorTab } from "../components/inspector/tabs";
import { useAssetMap } from "../composables/useAssetMap";
import { useCollapsedSidebar } from "../composables/useCollapsedSidebar";
import { useLiveReplayer, useLiveReplayerDisposal } from "../composables/useLiveReplayer";
import { useLiveScreenFeed } from "../composables/useLiveScreenFeed";
import { useRecording } from "../composables/useRecording";
import { useRecordingEvents } from "../composables/useRecordingEvents";
import { usePlayerShortcuts } from "../composables/usePlayerShortcuts";
import { useReplayer, useReplayerDisposal } from "../composables/useReplayer";
import { useStageLayout } from "../composables/useStageLayout";
import { bugReport, linkAt } from "../lib/bug-report";
import { adjacentIssue, issuesOf } from "../lib/issues";
import { rageTaps, recentTaps, tapsOf } from "../lib/taps";
import { sessionDeviceLabel } from "../lib/recording-columns";
import { buildTimeline, sessionBounds, timelineMarkers } from "../lib/timeline";
import { trackMarks } from "../lib/track-marks";
import { deleteRecording } from "../services/recordings.service";

/** How far behind the newest data a followed live session plays, by where its screen comes from. */
const LIVE_LAG_MS = { segments: 2500, socket: 400 } as const;

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

const safeArea = computed(() => session.value?.device?.safeArea ?? null);
const assetMap = useAssetMap(assets, safeArea);
const events = useRecordingEvents({
  recordingId,
  segments,
  assets: assetMap.map,
  assetsReady: assetMap.ready,
  safeArea,
  onReplay: (replay) => {
    const kept = liveFeed.fromSegment(replay);
    if (kept.length > 0) player.push(kept);
  },
});
const live = computed(() => session.value?.live ?? false);
const liveFeed = useLiveScreenFeed({
  deviceUuid: computed(() => session.value?.device_uuid ?? null),
  live,
  assets: assetMap.map,
  assetsReady: assetMap.ready,
  safeArea,
  push: (replay) => player.push(replay),
  pushLive: (replay) => liveScreen.push(replay),
});
/**
 * Following a live device draws each event the moment it arrives, as Assist does; the player's own
 * clock would reach the end of what has arrived, hold, and stall until more came.
 */
const liveScreen = useLiveReplayer({
  root: computed(() => stageView.value?.liveRoot ?? null),
  stage: computed(() => stageView.value?.stage ?? null),
  assets: assetMap.map,
  safeArea: liveFeed.insets,
});
useLiveReplayerDisposal(liveScreen);
const liveLag = computed(() =>
  liveFeed.state.value === "streaming" ? LIVE_LAG_MS.socket : LIVE_LAG_MS.segments,
);

const hasScreen = computed(() => segments.value?.some((segment) => segment.full_snapshot) ?? false);
const bounds = computed(() => {
  const current = session.value;
  if (!current) return { start: 0, end: 1000 };
  const recorded = sessionBounds(
    events.lanes.value,
    Date.parse(current.started_at),
    Date.parse(current.ended_at),
  );
  const edge = liveFeed.edge.value;
  return edge !== null && edge > recorded.end ? { ...recorded, end: edge } : recorded;
});
const duration = computed(() => bounds.value.end - bounds.value.start);
watch(bounds, (value) => player.setTimeline(value.start, value.end - value.start), {
  immediate: true,
});

const tracks = computed(() => buildTimeline(events.lanes.value, bounds.value));
const taps = computed(() => tapsOf(events.lanes.value.replay));
const rage = computed(() => rageTaps(taps.value));
const playhead = computed(() => bounds.value.start + shownTime.value);
const ripples = computed(() => recentTaps(taps.value, playhead.value));
const issues = computed(() => issuesOf(events.lanes.value, rage.value));
const marks = computed(() =>
  trackMarks(issues.value, timelineMarkers(events.lanes.value, bounds.value), bounds.value),
);
/** A jump lands this long before an issue, so where the player stands is judged from the issue. */
const ISSUE_LEAD_MS = 1500;
const issueAnchor = computed(() => playhead.value + ISSUE_LEAD_MS);
const issueIndex = computed(
  () => issues.value.filter((issue) => issue.t <= issueAnchor.value + 400).length,
);

const panel = useStorage("capuchoo.recording.panel", true);
const inspectorTab = useStorage<InspectorTab>("capuchoo.recording.tab", "activity");
if (!isInspectorTab(inspectorTab.value)) inspectorTab.value = "activity";

useCollapsedSidebar();
const workspace = useTemplateRef<HTMLElement>("workspace");
const { stageStyle } = useStageLayout({
  workspace,
  viewport: computed(() => player.shape.value ?? player.viewport.value),
  fallback: computed(() => session.value?.device?.screen ?? null),
  panel,
});
const loadedRatio = computed(() =>
  events.total.value === 0 ? 1 : events.loaded.value / events.total.value,
);

const followList = ref(true);
const exportOpen = ref(false);
const followLive = ref(false);
const showLive = computed(
  () => followLive.value && liveFeed.state.value === "streaming" && liveScreen.ready.value,
);
watch(showLive, (on) => {
  if (on) player.pause();
});
/** The playhead as shown: the live edge while drawing live, the player's own time otherwise. */
const shownTime = computed(() => (showLive.value ? duration.value : player.time.value));

watch(recordingId, () => {
  player.destroy();
  followLive.value = false;
});

watch(live, (value, previous) => {
  if (value && !previous) followLive.value = true;
  if (!value) followLive.value = false;
});

watch(duration, (length) => {
  if (!followLive.value || showLive.value) return;
  if (player.time.value < length - liveLag.value * 2) player.seek(length - liveLag.value);
  if (!player.playing.value) player.play();
});

function toggle() {
  if (showLive.value) {
    followLive.value = false;
    player.seek(duration.value - liveLag.value);
    return;
  }
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
  if (!live.value) return;
  followLive.value = true;
  if (liveFeed.state.value === "streaming" && liveScreen.ready.value) return;
  player.seek(duration.value - liveLag.value);
  player.play();
}

function goToIssue(direction: 1 | -1) {
  const target = adjacentIssue(issues.value, issueAnchor.value, direction);
  if (!target) return;
  seekWall(Math.max(bounds.value.start, target.t - ISSUE_LEAD_MS));
  toast(target.label.split(/\r?\n/)[0] ?? "Issue", { duration: 2500, position: "top-center" });
}

usePlayerShortcuts({
  toggle,
  seekBy: (ms) => seekOffset(shownTime.value + ms),
  issue: goToIssue,
  view: (next) => {
    if (next === "screen") {
      panel.value = !panel.value;
      return;
    }
    panel.value = true;
    if (next === "data") inspectorTab.value = "data";
  },
  follow: jumpLive,
  exportTest: () => {
    exportOpen.value = true;
  },
});

const { copy } = useClipboard({ legacy: true });
const pageUrl = () => `${window.location.origin}${route.path}`;

async function copyLink() {
  await copy(linkAt(pageUrl(), shownTime.value));
  toast.success("Link copied - it opens the replay at this moment");
}

async function copyReport() {
  if (!session.value) return;
  await copy(
    bugReport({
      session: session.value,
      issues: issues.value,
      origin: bounds.value.start,
      pageUrl: pageUrl(),
    }),
  );
  toast.success("Bug report copied as Markdown");
}

const startAt = Number(route.query.t);
if (Number.isFinite(startAt) && startAt > 0) {
  const stop = watch(
    () => player.state.value,
    (state) => {
      if (state !== "ready") return;
      player.seek(startAt);
      stop();
    },
  );
}

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
  <div
    class="flex min-h-[calc(100svh-4rem)] flex-col gap-2 px-3 pt-2 pb-3 md:px-4 lg:h-[calc(100svh-5rem)] lg:min-h-[560px]"
  >
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
    <div v-else-if="!session" class="flex flex-1 flex-col gap-2" aria-busy="true">
      <Skeleton class="h-10 w-96 max-w-full" />
      <Skeleton class="min-h-0 flex-1" />
      <Skeleton class="h-20" />
    </div>
    <template v-else>
      <PlayerToolbar
        :app-id="appId"
        :session="session"
        :time="shownTime"
        @remove="removeOpen = true"
        @copy-link="copyLink"
        @copy-report="copyReport"
        @export-test="exportOpen = true"
      />

      <div
        ref="workspace"
        class="bg-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border lg:flex-row"
      >
        <section
          :class="[
            'relative flex min-h-0 min-w-0 shrink-0 flex-col',
            panel
              ? 'h-[56svh] border-b lg:h-auto lg:border-r lg:border-b-0'
              : 'h-[72svh] flex-1 lg:h-auto',
          ]"
          :style="stageStyle"
          aria-label="Screen"
        >
          <InspectorToggle v-if="!panel" v-model="panel" class="absolute top-3 right-3 z-10" />
          <ReplayStage
            ref="stageView"
            :state="player.state.value"
            :viewport="showLive ? liveScreen.viewport.value : player.viewport.value"
            :scale="showLive ? liveScreen.scale.value : player.scale.value"
            :show-live="showLive"
            :live-rate="liveFeed.rate.value"
            :has-screen="hasScreen"
            :loaded="events.loaded.value"
            :total="events.total.value"
            :live="live && followLive"
            :taps="ripples"
            :playhead="playhead"
          />
        </section>
        <section
          v-show="panel"
          class="flex min-h-[60svh] min-w-0 flex-1 flex-col lg:min-h-0"
          aria-label="Inspector"
        >
          <InspectorPanel
            v-model:follow="followList"
            v-model:tab="inspectorTab"
            :lanes="events.lanes.value"
            :playhead="playhead"
            :origin="bounds.start"
            :rage="rage"
            :version="session.version_name"
            @seek="seekWall"
          >
            <template #actions>
              <InspectorToggle v-model="panel" class="hidden lg:inline-flex" />
            </template>
          </InspectorPanel>
        </section>
      </div>

      <section
        class="bg-card max-lg:bg-background/95 rounded-xl border px-2 py-1 max-lg:sticky max-lg:bottom-2 max-lg:z-20 max-lg:shadow-lg max-lg:backdrop-blur-md"
        aria-label="Playback"
      >
        <PlaybackDock
          :playing="showLive || player.playing.value"
          :time="shownTime"
          :duration="duration"
          :speed="player.speed.value"
          :skip-inactive="player.skipInactive.value"
          :live="live"
          :following="followLive"
          :issue-count="issues.length"
          :issue-index="issueIndex"
          :tracks="tracks"
          :marks="marks"
          :loaded="loadedRatio"
          @toggle="toggle"
          @issue="goToIssue"
          @seek="seekOffset"
          @speed="player.setSpeed"
          @skip-inactive="player.setSkipInactive"
          @follow="jumpLive"
        />
      </section>

      <ExportTestDialog
        v-model:open="exportOpen"
        :app-id="appId"
        :session="session"
        :lanes="events.lanes.value"
        :bounds="bounds"
        :viewport="player.shape.value ?? player.viewport.value"
        :time="shownTime"
      />
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
