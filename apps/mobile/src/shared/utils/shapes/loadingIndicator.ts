import { springAt } from "@/shared/utils/motion/spring";
import { materialShapeCubics, type MaterialShapeName } from "./materialShapes";
import { morphOutline, reachOf, sampleOutline, type Outline } from "./morph";

/**
 * Material 3 Expressive's loading indicator, as `androidx.compose.material3.LoadingIndicator`
 * animates it. The numbers are Compose's own:
 * - indeterminate: seven shapes in a loop, one morph every 650 ms driven by a spring (damping 0.6,
 *   stiffness 200) that settles inside the interval; each morph also turns the shape a quarter,
 *   and the whole indicator turns once every 4666 ms, linearly;
 * - determinate: circle to soft burst as progress goes 0 to 1, turning back half a turn.
 *
 * One difference, stated plainly: Compose's `Morph` pairs the two shapes' corners before
 * interpolating. This samples both outlines evenly by length from the same start angle and moves
 * point to point - visually the same flow on these rounded shapes, not the same algorithm.
 */
export const INDETERMINATE_SHAPES: readonly MaterialShapeName[] = [
  "softBurst",
  "cookie9",
  "pentagon",
  "pill",
  "sunny",
  "cookie4",
  "oval",
];

export const MORPH_INTERVAL_MS = 650;
export const GLOBAL_ROTATION_MS = 4666;
const MORPH_DAMPING = 0.6;
const MORPH_STIFFNESS = 200;

/** 38dp of shape in a 48dp container - `LoadingIndicatorDefaults.ActiveIndicatorScale`. */
export const ACTIVE_INDICATOR_SCALE = 38 / 48;

const POINTS = 144;

interface Sequence {
  outlines: Outline[];
  /** Fits the widest reach of any shape in the sequence, so rotation never clips a corner. */
  scale: number;
}

let indeterminate: Sequence | null = null;
let determinate: Sequence | null = null;

function build(names: readonly MaterialShapeName[]): Sequence {
  const outlines = names.map((name) => sampleOutline(materialShapeCubics(name), POINTS));
  const reach = Math.max(...outlines.map(reachOf));
  return { outlines, scale: 0.5 / reach };
}

function indeterminateSequence(): Sequence {
  indeterminate ??= build(INDETERMINATE_SHAPES);
  return indeterminate;
}

/**
 * Compose rotates the circle by a twentieth of a turn so its vertices line up with the burst's.
 * Sampling by length from a fixed start angle makes a circle the same outline at any rotation, so
 * that step has nothing to do here.
 */
function determinateSequence(): Sequence {
  determinate ??= build(["circle", "softBurst"]);
  return determinate;
}

export interface IndicatorFrame {
  outline: Outline;
  /** Degrees, clockwise. */
  rotation: number;
  scale: number;
}

export function createOutlineBuffer(): Outline {
  return new Float32Array(POINTS * 2);
}

export function indeterminateFrame(elapsedMs: number, into: Outline): IndicatorFrame {
  const sequence = indeterminateSequence();
  const count = sequence.outlines.length;
  const step = Math.floor(elapsedMs / MORPH_INTERVAL_MS);
  const local = (elapsedMs - step * MORPH_INTERVAL_MS) / 1000;
  const spring = springAt(local, MORPH_DAMPING, MORPH_STIFFNESS);
  const progress = Math.min(1, Math.max(0, spring));

  morphOutline(
    sequence.outlines[step % count]!,
    sequence.outlines[(step + 1) % count]!,
    progress,
    into,
  );

  const global = ((elapsedMs % GLOBAL_ROTATION_MS) / GLOBAL_ROTATION_MS) * 360;
  const rotation = (spring * 90 + 90 * (step + 1) + global) % 360;
  return { outline: into, rotation, scale: sequence.scale };
}

export function determinateFrame(progress: number, into: Outline): IndicatorFrame {
  const sequence = determinateSequence();
  const clamped = Math.min(1, Math.max(0, progress));
  morphOutline(sequence.outlines[0]!, sequence.outlines[1]!, clamped, into);
  return { outline: into, rotation: -clamped * 180, scale: sequence.scale };
}
