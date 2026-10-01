/**
 * Material 3's pull-to-refresh physics, from `androidx.compose.material3.pulltorefresh`: the finger
 * moves the indicator at half speed (`DragMultiplier`) up to an 80dp threshold, and past it the
 * pull meets growing tension and the indicator stops at twice the threshold. Its progress is its
 * travel over the threshold, so the shape's morph runs exactly as fast as the hand pulls.
 */
export const PULL_THRESHOLD_PX = 80;
export const DRAG_MULTIPLIER = 0.5;
/** `LoadingIndicatorDefaults.ContainerHeight`: the indicator starts fully hidden above the edge. */
export const INDICATOR_SIZE_PX = 48;

/** Indicator travel over the threshold for a finger `pulled` pixels down: 0 hidden, 1 armed. */
export function pullFraction(pulled: number, threshold = PULL_THRESHOLD_PX): number {
  const adjusted = Math.max(0, pulled) * DRAG_MULTIPLIER;
  if (adjusted <= threshold) return adjusted / threshold;
  const linear = Math.min(2, adjusted / threshold - 1);
  return 1 + linear - (linear * linear) / 4;
}

/** Released past the threshold: refresh. Anything less springs back without one. */
export function isArmed(pulled: number, threshold = PULL_THRESHOLD_PX): boolean {
  return Math.max(0, pulled) * DRAG_MULTIPLIER > threshold;
}

/** Where the indicator's top edge sits, measured from the content's top edge. */
export function indicatorOffset(fraction: number, threshold = PULL_THRESHOLD_PX): number {
  return fraction * threshold - INDICATOR_SIZE_PX;
}

/** Past the threshold the whole indicator keeps turning with the pull, as Compose does. */
export function overpullRotation(fraction: number): number {
  return fraction > 1 ? -(fraction - 1) * 180 : 0;
}
