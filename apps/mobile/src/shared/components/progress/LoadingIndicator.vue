<template>
  <span
    ref="root"
    class="loading-indicator"
    :class="{ contained }"
    :style="{ width: `${size}px`, height: `${size}px` }"
    role="progressbar"
    :aria-label="label"
    :aria-valuenow="progress === undefined ? undefined : Math.round(progress * 100)"
  >
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <path :d="path" :transform="`rotate(${rotation.toFixed(1)} 50 50)`" />
    </svg>
  </span>
</template>

<script setup lang="ts">
import { outlinePath } from "@/shared/utils/shapes/morph";
import {
  ACTIVE_INDICATOR_SCALE,
  createOutlineBuffer,
  determinateFrame,
  indeterminateFrame,
} from "@/shared/utils/shapes/loadingIndicator";

/**
 * Material 3 Expressive's loading indicator - a shape that morphs through seven others while it
 * turns, never a spinner. Indeterminate without `progress`; with it, a circle swelling into a soft
 * burst. `contained` puts it on a primary-container disc, for a loader over content. Off-screen,
 * in a hidden document or under reduced motion the loop stops; reduced motion keeps one still
 * shape, which still says "working".
 */
const props = withDefaults(
  defineProps<{ size?: number; progress?: number; contained?: boolean; label: string }>(),
  { size: 48, progress: undefined, contained: false },
);

const root = useTemplateRef<HTMLElement>("root");
const buffer = createOutlineBuffer();
const path = ref("");
const rotation = ref(0);

const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
const onScreen = useElementVisibility(root);
const visibility = useDocumentVisibility();

function draw(elapsed: number): void {
  const frame =
    props.progress === undefined
      ? indeterminateFrame(elapsed, buffer)
      : determinateFrame(props.progress, buffer);
  path.value = outlinePath(frame.outline, frame.scale * ACTIVE_INDICATOR_SCALE);
  rotation.value = frame.rotation;
}

let started = 0;
const { pause, resume } = useRafFn(
  ({ timestamp }) => {
    if (!started) started = timestamp;
    draw(timestamp - started);
  },
  { immediate: false },
);

watchEffect(() => {
  const running = !reduced.value && onScreen.value && visibility.value === "visible";
  if (running && props.progress === undefined) resume();
  else {
    pause();
    draw(0);
  }
});

watch(
  () => props.progress,
  () => props.progress !== undefined && draw(0),
);
</script>

<style scoped>
.loading-indicator {
  display: inline-grid;
  place-items: center;
  flex: none;
  color: var(--primary);
}

.loading-indicator svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.loading-indicator path {
  fill: currentColor;
}

.loading-indicator.contained {
  border-radius: 999px;
  background: var(--primary-container);
  color: var(--primary-container-foreground);
}

.loading-indicator.contained svg {
  width: 79%;
  height: 79%;
}
</style>
