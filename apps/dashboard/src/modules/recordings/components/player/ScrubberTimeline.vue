<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue";
import { formatOffset } from "../../lib/activity";
import type { TimelineTrack } from "../../lib/timeline";
import { marksNear, type TrackMark } from "../../lib/track-marks";
import { TONE_COLOR } from "../../lib/tones";
import TimelineLanes from "./TimelineLanes.vue";

const props = defineProps<{
  tracks: readonly TimelineTrack[];
  marks: readonly TrackMark[];
  duration: number;
  time: number;
  /** How much of the timeline has loaded, 0..1. */
  loaded: number;
  lanes: boolean;
}>();
const emit = defineEmits<{ seek: [ms: number] }>();

/** How close, in pixels, the pointer has to be for a mark's label to show. */
const MARK_REACH_PX = 6;

const surface = useTemplateRef<HTMLElement>("surface");
const hover = ref<number | null>(null);
const hoverWidth = ref(1);
const dragging = ref(false);

const progress = computed(() =>
  props.duration > 0 ? Math.min(1, props.time / props.duration) : 0,
);
const hovered = computed(() => {
  if (hover.value === null) return [];
  return marksNear(props.marks, hover.value, MARK_REACH_PX / hoverWidth.value).slice(0, 3);
});

function ratioAt(clientX: number): number {
  const box = surface.value?.getBoundingClientRect();
  if (!box || box.width === 0) return 0;
  hoverWidth.value = box.width;
  return Math.min(1, Math.max(0, (clientX - box.left) / box.width));
}

function onDown(event: PointerEvent) {
  if (event.button !== 0) return;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  dragging.value = true;
  emit("seek", ratioAt(event.clientX) * props.duration);
}

function onMove(event: PointerEvent) {
  hover.value = ratioAt(event.clientX);
  if (dragging.value) emit("seek", hover.value * props.duration);
}

function onUp(event: PointerEvent) {
  dragging.value = false;
  (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
}

function onKey(event: KeyboardEvent) {
  const step = event.shiftKey ? 30_000 : 5000;
  const moves: Record<string, number> = {
    ArrowLeft: props.time - step,
    ArrowRight: props.time + step,
    Home: 0,
    End: props.duration,
  };
  const target = moves[event.key];
  if (target === undefined) return;
  event.preventDefault();
  emit("seek", Math.max(0, Math.min(props.duration, target)));
}

const at = (ratio: number) => ({ left: `${ratio * 100}%` });
</script>

<template>
  <div
    ref="surface"
    class="group/scrub relative cursor-pointer touch-none rounded-sm outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50"
    role="slider"
    tabindex="0"
    aria-label="Playback position"
    :aria-valuemin="0"
    :aria-valuemax="Math.round(props.duration / 1000)"
    :aria-valuenow="Math.round(props.time / 1000)"
    :aria-valuetext="`${formatOffset(props.time)} of ${formatOffset(props.duration)}`"
    :data-dragging="dragging || undefined"
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointerleave="hover = null"
    @keydown="onKey"
  >
    <div class="relative flex h-8 items-center">
      <div
        class="bg-foreground/15 relative h-1.5 w-full overflow-hidden rounded-full transition-[height] duration-150 group-hover/scrub:h-2 group-data-[dragging]/scrub:h-2"
      >
        <div
          class="bg-foreground/15 absolute inset-y-0 left-0"
          :style="{ width: `${props.loaded * 100}%` }"
        />
        <div
          class="bg-primary absolute inset-y-0 left-0"
          :style="{ width: `${progress * 100}%` }"
        />
      </div>
      <span
        v-for="mark in props.marks"
        :key="mark.id"
        class="ring-background pointer-events-none absolute top-1/2 h-3 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full ring-1"
        :style="{ ...at(mark.at), background: TONE_COLOR[mark.tone] }"
      />
      <span
        class="bg-primary ring-background pointer-events-none absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-sm ring-2 transition-transform group-hover/scrub:scale-110 group-data-[dragging]/scrub:scale-125"
        :style="at(progress)"
      />
    </div>

    <div v-if="props.lanes" class="relative hidden pb-1 md:block">
      <TimelineLanes :tracks="props.tracks" />
      <div
        class="bg-foreground/[0.05] pointer-events-none absolute inset-y-0 left-0"
        :style="{ width: `${progress * 100}%` }"
      />
      <div
        class="bg-primary pointer-events-none absolute inset-y-0 w-px -translate-x-1/2"
        :style="at(progress)"
      />
    </div>

    <div
      v-if="hover !== null"
      class="pointer-events-none absolute top-1 bottom-0 w-px -translate-x-1/2 bg-foreground/30"
      :style="at(hover)"
    >
      <div
        class="bg-popover text-popover-foreground absolute bottom-full left-1/2 mb-1 flex max-w-72 -translate-x-1/2 flex-col items-center gap-0.5 rounded-md border px-2 py-1 shadow-md"
      >
        <span class="tabular font-mono text-[11px]">{{
          formatOffset(hover * props.duration)
        }}</span>
        <span
          v-for="mark in hovered"
          :key="mark.id"
          class="flex max-w-full items-center gap-1.5 text-[11px]"
        >
          <span
            class="size-1.5 shrink-0 rounded-full"
            :style="{ background: TONE_COLOR[mark.tone] }"
          />
          <span class="truncate">{{ mark.label }}</span>
        </span>
      </div>
    </div>
  </div>
</template>
