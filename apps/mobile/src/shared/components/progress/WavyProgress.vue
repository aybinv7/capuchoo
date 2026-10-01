<template>
  <svg
    ref="root"
    class="wavy-progress block w-full rtl:-scale-x-100"
    :height="HEIGHT"
    :viewBox="`0 0 ${String(width)} ${String(HEIGHT)}`"
    role="progressbar"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-valuenow="Math.round(progress * 100)"
    :aria-label="label"
  >
    <path v-if="track" class="wavy-track" :d="track" />
    <circle v-if="stopShown" class="wavy-stop" :cx="width - STOP / 2" :cy="MID" :r="STOP / 2" />
    <path v-if="active" class="wavy-active" :d="active" />
  </svg>
</template>

<script setup lang="ts">
/*
 * Numbers from androidx Compose Material3 `LinearProgressIndicatorTokens` and
 * `WavyProgressIndicatorDefaults`: a 10dp container, 4dp strokes with round caps, a 3dp wave of
 * 40dp moving one wavelength a second, a 4dp gap before the track and a 4dp stop dot at its end.
 */
const HEIGHT = 10;
const STROKE = 4;
const AMPLITUDE = 3;
const WAVELENGTH = 40;
const GAP = 4;
const STOP = 4;
const MID = HEIGHT / 2;
const CAP = STROKE / 2;
/** Compose's `DurationLong2`: how long the wave takes to rise or settle flat. */
const AMPLITUDE_MS = 500;
/** How long a new value takes to be reached, the emphasized-decelerate feel of a settle. */
const PROGRESS_MS = 600;
const STEP_PX = 2;

/**
 * The Material 3 Expressive wavy linear progress indicator: flat at the very start and the very
 * end (Compose's default amplitude is zero at or below 10% and at or above 95%), a travelling wave
 * in between. It animates on the compositor-free path it has to - redrawing one SVG path per frame
 * - only while the wave moves or the value is settling, and holds still under reduced motion.
 */
const props = defineProps<{ progress: number; label: string }>();

const root = useTemplateRef<SVGSVGElement>("root");
const { width: measured } = useElementSize(root);
const width = computed(() => Math.max(measured.value, CAP * 4));
const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");

const target = computed(() => Math.min(1, Math.max(0, props.progress)));
const shown = ref(target.value);
const amplitude = ref(waveFor(target.value) ? 1 : 0);
const phase = ref(0);

function waveFor(value: number): boolean {
  return value > 0.1 && value < 0.95;
}

function wavePath(from: number, to: number): string {
  if (to <= from) return "";
  const lift = AMPLITUDE * amplitude.value;
  const points: string[] = [];
  for (let x = from; x < to; x += STEP_PX) points.push(point(x, lift));
  points.push(point(to, lift));
  return `M${points.join("L")}`;
}

function point(x: number, lift: number): string {
  const y = MID + lift * Math.sin(((x + phase.value) / WAVELENGTH) * Math.PI * 2);
  return `${x.toFixed(1)} ${y.toFixed(2)}`;
}

const activeEnd = computed(() => shown.value * width.value);

const active = computed(() =>
  shown.value <= 0 ? "" : wavePath(CAP, Math.max(CAP, activeEnd.value - CAP)),
);

const track = computed(() => {
  const start = (shown.value <= 0 ? 0 : activeEnd.value + GAP) + CAP;
  const end = width.value - CAP;
  return end > start ? `M${start.toFixed(1)} ${String(MID)}L${end.toFixed(1)} ${String(MID)}` : "";
});

const stopShown = computed(() => activeEnd.value + GAP + STOP < width.value);

let last = 0;

function frame(delta: number): void {
  const step = Math.min(delta, 64);
  const goal = target.value;
  if (shown.value !== goal) {
    const move = (goal - shown.value) * Math.min(1, (step / PROGRESS_MS) * 4);
    shown.value = Math.abs(goal - shown.value) < 0.001 ? goal : shown.value + move;
  }
  const wanted = waveFor(shown.value) ? 1 : 0;
  if (amplitude.value !== wanted) {
    const change = step / AMPLITUDE_MS;
    amplitude.value =
      wanted > amplitude.value
        ? Math.min(1, amplitude.value + change)
        : Math.max(0, amplitude.value - change);
  }
  if (amplitude.value > 0) phase.value = (phase.value - (WAVELENGTH * step) / 1000) % WAVELENGTH;
}

const settled = computed(
  () => shown.value === target.value && amplitude.value === (waveFor(target.value) ? 1 : 0),
);

const { pause, resume } = useRafFn(
  ({ timestamp }) => {
    const delta = last ? timestamp - last : 16;
    last = timestamp;
    frame(delta);
  },
  { immediate: false },
);

/*
 * Frames only while something moves and someone can see it: Framework7 keeps the pages behind the
 * current one mounted, and a wave on one of those would burn a frame budget for nobody.
 */
const onScreen = useElementVisibility(root);
const visibility = useDocumentVisibility();
const needsFrames = computed(
  () =>
    !reduced.value &&
    onScreen.value &&
    visibility.value === "visible" &&
    (!settled.value || amplitude.value > 0),
);

watch(
  needsFrames,
  (need) => {
    if (!need) {
      pause();
      return;
    }
    last = 0;
    resume();
  },
  { immediate: true },
);

watch(
  [reduced, target],
  () => {
    if (!reduced.value) return;
    shown.value = target.value;
    amplitude.value = waveFor(target.value) ? 1 : 0;
  },
  { immediate: true },
);
</script>

<style scoped>
.wavy-progress {
  overflow: visible;
}

.wavy-active {
  fill: none;
  stroke: var(--primary);
  stroke-width: 4px;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.wavy-track {
  fill: none;
  stroke: var(--secondary);
  stroke-width: 4px;
  stroke-linecap: round;
}

.wavy-stop {
  fill: var(--primary);
}
</style>
