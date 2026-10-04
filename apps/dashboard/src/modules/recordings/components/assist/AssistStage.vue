<script setup lang="ts">
import { MousePointer2, Pointer } from "@lucide/vue";
import { useIntervalFn } from "@vueuse/core";
import { computed, ref, useTemplateRef } from "vue";
import { toAppPoint, wheelDelta } from "../../lib/assist-coordinates";
import type { AssistPhase } from "../../types/assist.types";

const props = defineProps<{
  phase: AssistPhase;
  ready: boolean;
  viewport: { width: number; height: number } | null;
  scale: number;
  /** Whether the user gave control: clicks become taps and the wheel scrolls. */
  controlling: boolean;
  /** Where the phone's user last touched, in the app's pixels. */
  touch: { x: number; y: number; at: number } | null;
}>();
const emit = defineEmits<{
  pointer: [x: number, y: number];
  pointerOff: [];
  tap: [x: number, y: number];
  scroll: [x: number, y: number, dx: number, dy: number];
}>();

/** How long the user's finger stays on screen after a touch. */
const TOUCH_SHOWN_MS = 1200;
/** A touch this close in place and time to the agent's own tap is that tap, echoed by the phone. */
const ECHO_PX = 12;
const ECHO_MS = 1500;

const stage = useTemplateRef<HTMLElement>("stage");
const root = useTemplateRef<HTMLElement>("root");
const surface = useTemplateRef<HTMLElement>("surface");
defineExpose({ stage, root });

const mine = ref<{ x: number; y: number } | null>(null);
const lastTap = ref<{ x: number; y: number; at: number } | null>(null);
const now = ref(Date.now());
useIntervalFn(() => (now.value = Date.now()), 200);

const frame = computed(() => {
  if (!props.viewport) return undefined;
  return {
    width: `${Math.round(props.viewport.width * props.scale)}px`,
    height: `${Math.round(props.viewport.height * props.scale)}px`,
    "--replay-scale": String(props.scale),
  };
});

/** The user's last touch, while it is recent and was not the agent's own tap coming back. */
const finger = computed(() => {
  const touch = props.touch;
  if (!touch || now.value - touch.at > TOUCH_SHOWN_MS) return null;
  const tap = lastTap.value;
  if (
    tap &&
    Math.abs(touch.at - tap.at) < ECHO_MS &&
    Math.hypot(touch.x - tap.x, touch.y - tap.y) < ECHO_PX
  ) {
    return null;
  }
  return { left: `${touch.x * props.scale}px`, top: `${touch.y * props.scale}px` };
});

function point(event: { clientX: number; clientY: number }) {
  const box = surface.value?.getBoundingClientRect();
  if (!box || !props.viewport) return null;
  return toAppPoint(event.clientX, event.clientY, box, props.viewport, props.scale);
}

function onMove(event: PointerEvent) {
  const at = point(event);
  mine.value = at;
  if (at) emit("pointer", at.x, at.y);
}

function onLeave() {
  mine.value = null;
  emit("pointerOff");
}

function onClick(event: MouseEvent) {
  if (!props.controlling) return;
  const at = point(event);
  if (!at) return;
  lastTap.value = { ...at, at: Date.now() };
  emit("tap", at.x, at.y);
}

function onWheel(event: WheelEvent) {
  if (!props.controlling || !props.viewport) return;
  const at = point(event);
  if (!at) return;
  event.preventDefault();
  const { dx, dy } = wheelDelta(event, props.viewport, props.scale);
  emit("scroll", at.x, at.y, dx, dy);
}
</script>

<template>
  <div
    ref="stage"
    class="bg-muted/40 dot-grid relative flex h-full min-h-80 w-full items-center justify-center overflow-hidden"
  >
    <div
      v-show="props.ready"
      class="ring-foreground/85 relative overflow-hidden rounded-[22px] bg-white shadow-[0_24px_60px_-20px_rgb(0_0_0/0.45)] ring-[6px] transition-shadow"
      :class="
        props.controlling
          ? 'shadow-[0_0_0_3px_var(--destructive),0_24px_60px_-20px_rgb(0_0_0/0.45)]'
          : ''
      "
      :style="frame"
    >
      <div ref="root" class="replay-root absolute inset-0" />

      <div
        v-if="finger"
        class="pointer-events-none absolute z-10 flex items-start"
        :style="finger"
        aria-hidden="true"
      >
        <Pointer
          class="fill-info text-background -mt-0.5 -ml-2 size-6 drop-shadow-[0_2px_3px_rgb(0_0_0/0.4)]"
        />
        <span
          class="bg-info mt-5 -ml-1 rounded-full px-1.5 py-px text-[10px] leading-4 font-semibold text-white shadow"
          >User</span
        >
      </div>

      <div
        v-if="mine"
        class="pointer-events-none absolute z-20 flex items-start"
        :style="{ left: `${mine.x * props.scale}px`, top: `${mine.y * props.scale}px` }"
        aria-hidden="true"
      >
        <MousePointer2
          class="text-background -mt-0.5 -ml-0.5 size-5 drop-shadow-[0_2px_3px_rgb(0_0_0/0.4)]"
          :class="props.controlling ? 'fill-destructive' : 'fill-primary'"
        />
        <span
          class="mt-4 -ml-1 rounded-full px-1.5 py-px text-[10px] leading-4 font-semibold text-white shadow"
          :class="props.controlling ? 'bg-destructive' : 'bg-primary'"
          >You</span
        >
      </div>

      <div
        ref="surface"
        class="absolute inset-0 z-30 cursor-none"
        role="application"
        :aria-label="
          props.controlling
            ? 'The user\'s screen: click to tap, scroll to scroll'
            : 'The user\'s screen: move to point'
        "
        @pointermove="onMove"
        @pointerleave="onLeave"
        @click="onClick"
        @wheel="onWheel"
      />
    </div>
    <slot />
  </div>
</template>

<style scoped>
.replay-root :deep(.replayer-wrapper) {
  transform: scale(var(--replay-scale, 1));
  transform-origin: top left;
}
.replay-root :deep(iframe) {
  border: 0;
  pointer-events: none;
}
.replay-root :deep(.replayer-mouse),
.replay-root :deep(.replayer-mouse-tail) {
  display: none;
}
</style>
