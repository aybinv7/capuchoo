<script setup lang="ts">
import { Flag, MapPin, PauseCircle, TriangleAlert, Zap } from "@lucide/vue";
import { computed, ref, useTemplateRef } from "vue";
import { formatOffset } from "../../lib/activity";
import type { TimelineTrack } from "../../lib/timeline";
import TimelineLanes from "./TimelineLanes.vue";

const props = defineProps<{
  tracks: readonly TimelineTrack[];
  markers: ReadonlyArray<{ id: string; at: number; kind: string; label: string }>;
  duration: number;
  time: number;
  /** How much of the timeline has loaded, 0..1. */
  loaded: number;
}>();
const emit = defineEmits<{ seek: [ms: number] }>();

const surface = useTemplateRef<HTMLElement>("surface");
const hover = ref<number | null>(null);
const dragging = ref(false);

const progress = computed(() =>
  props.duration > 0 ? Math.min(1, props.time / props.duration) : 0,
);

const MARKER_ICONS: Record<string, typeof Flag> = {
  trigger: Flag,
  escalate: Flag,
  route: MapPin,
  "replay-paused": PauseCircle,
  "database-unsupported": TriangleAlert,
  rage: Zap,
};
const visibleMarkers = computed(() =>
  props.markers.filter((marker) => marker.kind in MARKER_ICONS),
);

function ratioAt(clientX: number): number {
  const box = surface.value?.getBoundingClientRect();
  if (!box || box.width === 0) return 0;
  const gutter = window.matchMedia("(min-width: 768px)").matches ? 72 : 0;
  return Math.min(1, Math.max(0, (clientX - box.left - gutter) / (box.width - gutter)));
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

const position = (ratio: number) => ({
  left: `calc(var(--gutter) + (100% - var(--gutter)) * ${ratio})`,
});
</script>

<template>
  <div
    ref="surface"
    class="group relative cursor-pointer touch-none py-1 outline-none select-none [--gutter:0px] focus-visible:ring-2 focus-visible:ring-ring/50 md:[--gutter:72px]"
    role="slider"
    tabindex="0"
    aria-label="Playback position"
    :aria-valuemin="0"
    :aria-valuemax="Math.round(props.duration / 1000)"
    :aria-valuenow="Math.round(props.time / 1000)"
    :aria-valuetext="`${formatOffset(props.time)} of ${formatOffset(props.duration)}`"
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointerleave="hover = null"
    @keydown="onKey"
  >
    <div class="relative mb-1 h-4">
      <span
        v-for="marker in visibleMarkers"
        :key="marker.id"
        class="text-muted-foreground absolute top-0 -translate-x-1/2"
        :class="
          marker.kind === 'rage'
            ? 'text-destructive'
            : marker.kind === 'trigger' || marker.kind === 'escalate'
              ? 'text-primary'
              : ''
        "
        :style="position(marker.at)"
        :title="marker.label"
      >
        <component :is="MARKER_ICONS[marker.kind]" class="size-3.5" aria-hidden="true" />
      </span>
    </div>

    <div class="relative">
      <TimelineLanes :tracks="props.tracks" />
      <div
        class="bg-foreground/[0.04] pointer-events-none absolute inset-y-0"
        :style="{ left: 'var(--gutter)', width: `calc((100% - var(--gutter)) * ${progress})` }"
      />
      <div
        v-if="props.loaded < 1"
        class="bg-background/60 pointer-events-none absolute inset-y-0 right-0 backdrop-grayscale"
        :style="{ width: `calc((100% - var(--gutter)) * ${1 - props.loaded})` }"
      />
    </div>

    <div
      class="bg-primary pointer-events-none absolute top-5 bottom-0 w-0.5 -translate-x-1/2 rounded-full"
      :style="position(progress)"
    >
      <span
        class="bg-primary ring-background absolute -top-1 left-1/2 size-2.5 -translate-x-1/2 rounded-full ring-2"
      />
    </div>

    <div
      v-if="hover !== null"
      class="pointer-events-none absolute top-5 bottom-0 w-px -translate-x-1/2 bg-foreground/30"
      :style="position(hover)"
    >
      <span
        class="bg-popover text-popover-foreground tabular absolute -top-6 left-1/2 -translate-x-1/2 rounded border px-1.5 py-0.5 font-mono text-[10px] shadow-sm"
        >{{ formatOffset(hover * props.duration) }}</span
      >
    </div>
  </div>
</template>
