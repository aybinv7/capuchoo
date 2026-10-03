<script setup lang="ts">
import { MonitorOff, TriangleAlert } from "@lucide/vue";
import { computed, useTemplateRef } from "vue";
import { Spinner } from "@/components/ui/spinner";
import type { ReplayerState } from "../../composables/useReplayer";
import type { Tap } from "../../lib/taps";

const props = defineProps<{
  state: ReplayerState;
  viewport: { width: number; height: number } | null;
  scale: number;
  /** Whether the session has any screen recording at all. */
  hasScreen: boolean;
  loaded: number;
  total: number;
  live: boolean;
  /** Taps just before the playhead, drawn as ripples. */
  taps: readonly Tap[];
  /** Wall clock of the playhead, for each ripple's age. */
  playhead: number;
}>();

const stage = useTemplateRef<HTMLElement>("stage");
const root = useTemplateRef<HTMLElement>("root");
defineExpose({ stage, root });

const frame = computed(() => {
  if (!props.viewport) return undefined;
  return {
    width: `${Math.round(props.viewport.width * props.scale)}px`,
    height: `${Math.round(props.viewport.height * props.scale)}px`,
    "--replay-scale": String(props.scale),
  };
});
const waiting = computed(
  () => props.hasScreen && props.state !== "ready" && props.state !== "failed",
);
</script>

<template>
  <div
    ref="stage"
    class="bg-muted/40 dot-grid relative flex h-full min-h-72 w-full items-center justify-center overflow-hidden"
  >
    <div
      v-show="props.state === 'ready'"
      class="ring-foreground/85 relative overflow-hidden rounded-[22px] bg-white shadow-[0_24px_60px_-20px_rgb(0_0_0/0.45)] ring-[6px]"
      :style="frame"
    >
      <div ref="root" class="replay-root absolute inset-0" />
      <span
        v-for="tap in props.taps"
        :key="tap.t"
        class="tap-ripple pointer-events-none absolute rounded-full"
        :style="{
          left: `${tap.x * props.scale}px`,
          top: `${tap.y * props.scale}px`,
          '--age': String(Math.min(1, (props.playhead - tap.t) / 650)),
        }"
        aria-hidden="true"
      />
    </div>

    <span
      v-if="props.live"
      class="bg-destructive absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white uppercase shadow"
    >
      <span class="size-1.5 animate-pulse rounded-full bg-white" />
      Live
    </span>

    <div v-if="waiting" class="text-muted-foreground flex flex-col items-center gap-3 text-sm">
      <Spinner class="size-5" />
      <span v-if="props.total > 0" class="tabular">
        Loading segment {{ Math.min(props.loaded + 1, props.total) }} of {{ props.total }}
      </span>
      <span v-else>Preparing the replay</span>
    </div>
    <div
      v-else-if="!props.hasScreen"
      class="text-muted-foreground flex max-w-xs flex-col items-center gap-2 text-center text-sm"
    >
      <MonitorOff class="size-6" aria-hidden="true" />
      <p class="text-foreground font-medium">No screen recording</p>
      <p class="text-pretty">
        Replay was off for this session. Its console, network and database lanes still play.
      </p>
    </div>
    <div
      v-else-if="props.state === 'failed'"
      class="text-muted-foreground flex max-w-xs flex-col items-center gap-2 text-center text-sm"
    >
      <TriangleAlert class="text-warning size-6" aria-hidden="true" />
      <p class="text-foreground font-medium">The player could not load</p>
      <p class="text-pretty">The lanes still work. Reload the page to try the screen again.</p>
    </div>
  </div>
</template>

<style scoped>
.replay-root :deep(.replayer-wrapper) {
  transform: scale(var(--replay-scale, 1));
  transform-origin: top left;
}
.tap-ripple {
  width: 44px;
  height: 44px;
  margin: -22px 0 0 -22px;
  border: 2px solid color-mix(in oklch, var(--primary) 85%, transparent);
  background: color-mix(in oklch, var(--primary) 22%, transparent);
  transform: scale(calc(0.45 + var(--age) * 0.75));
  opacity: calc(1 - var(--age));
}
.replay-root :deep(iframe) {
  border: 0;
  pointer-events: none;
}
</style>
