<script setup lang="ts">
import { computed, useTemplateRef, watch } from "vue";
import { useAssetMap } from "../../composables/useAssetMap";
import { useAssistSession } from "../../composables/useAssistSession";
import { useCollapsedSidebar } from "../../composables/useCollapsedSidebar";
import { useLiveReplayer, useLiveReplayerDisposal } from "../../composables/useLiveReplayer";
import AssistPanel from "./AssistPanel.vue";
import AssistStage from "./AssistStage.vue";
import AssistStatusCard from "./AssistStatusCard.vue";
import AssistToolbar from "./AssistToolbar.vue";

const props = defineProps<{ deviceId: string; deviceName: string }>();
const emit = defineEmits<{ again: [] }>();

useCollapsedSidebar();
const stageView = useTemplateRef<InstanceType<typeof AssistStage>>("stageView");

/** Screen events that arrive before the app's stylesheets are ready wait for them. */
let held: unknown[] = [];
const session = useAssistSession(props.deviceId, (events) => {
  if (assetMap.ready.value) live.push(events);
  else held.push(...events);
});
const assetMap = useAssetMap(computed(() => session.assets.value));
const live = useLiveReplayer({
  root: computed(() => stageView.value?.root ?? null),
  stage: computed(() => stageView.value?.stage ?? null),
  assets: assetMap.map,
});
useLiveReplayerDisposal(live);

watch(assetMap.ready, (ready) => {
  if (!ready || held.length === 0) return;
  const events = held;
  held = [];
  live.push(events);
});
watch(
  () => session.assets.value,
  (assets) => {
    if (assets.length === 0) assetMap.ready.value = true;
  },
);

const controlling = computed(() => session.control.value === "granted");
</script>

<template>
  <div
    class="flex min-h-[calc(100svh-4rem)] flex-col gap-2 px-3 pt-2 pb-3 md:px-4 lg:h-[calc(100svh-5rem)] lg:min-h-[560px]"
  >
    <AssistToolbar
      :device-id="props.deviceId"
      :device-name="props.deviceName"
      :phase="session.phase.value"
      :control="session.control.value"
      @end="session.end"
    />
    <div class="bg-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border lg:flex-row">
      <section
        class="relative flex min-h-[60svh] min-w-0 flex-1 flex-col lg:min-h-0"
        aria-label="Screen"
      >
        <AssistStage
          ref="stageView"
          :phase="session.phase.value"
          :ready="live.ready.value"
          :viewport="live.viewport.value"
          :scale="live.scale.value"
          :controlling="controlling"
          @pointer="session.pointer"
          @pointer-off="session.pointerOff"
          @tap="session.tap"
          @scroll="session.scroll"
        >
          <AssistStatusCard
            :phase="session.phase.value"
            :showing="live.ready.value"
            :invite-expires-at="session.info.value?.invite_expires_at ?? null"
            :outcome="session.outcome.value"
            @again="emit('again')"
          />
        </AssistStage>
      </section>
      <AssistPanel
        class="border-t lg:w-80 lg:shrink-0 lg:border-t-0 lg:border-l"
        :phase="session.phase.value"
        :control="session.control.value"
        :notices="session.notices.value"
        @request-control="session.requestControl"
        @release-control="session.releaseControl"
        @type="session.type"
        @key="session.key"
      />
    </div>
  </div>
</template>
