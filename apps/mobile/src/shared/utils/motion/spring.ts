/**
 * An underdamped spring from 0 to 1 at `seconds`, mass 1 - Compose's `spring(dampingRatio,
 * stiffness)` as a closed form, so a frame can ask where the spring is without integrating. It
 * overshoots past 1 and settles, which is the bounce Material's expressive motion is built on.
 */
export function springAt(seconds: number, dampingRatio: number, stiffness: number): number {
  if (seconds <= 0) return 0;
  const omega = Math.sqrt(stiffness);
  if (dampingRatio >= 1) {
    return 1 - (1 + omega * seconds) * Math.exp(-omega * seconds);
  }
  const decay = dampingRatio * omega;
  const damped = omega * Math.sqrt(1 - dampingRatio * dampingRatio);
  return (
    1 -
    Math.exp(-decay * seconds) *
      (Math.cos(damped * seconds) + (decay / damped) * Math.sin(damped * seconds))
  );
}

/** A cubic ease-out, close to Material 3's emphasized-decelerate, for moves that settle. */
export function easeOutCubic(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - (1 - clamped) ** 3;
}
