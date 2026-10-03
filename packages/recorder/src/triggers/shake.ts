export interface ShakeOptions {
  /** Change in acceleration, in m/s², that counts as a jolt. Default 18. */
  threshold?: number;
  /** Jolts needed within `windowMs`. Default 3. */
  jolts?: number;
  windowMs?: number;
  cooldownMs?: number;
}

/**
 * A deliberate shake: several sharp changes in acceleration within a second, then a cooldown so one
 * shake reports once. Android WebViews deliver `devicemotion` without a permission prompt.
 */
export function watchShake(onShake: () => void, options: ShakeOptions = {}): () => void {
  if (typeof window === "undefined" || !("DeviceMotionEvent" in window)) return () => undefined;
  const threshold = options.threshold ?? 18;
  const needed = options.jolts ?? 3;
  const windowMs = options.windowMs ?? 1000;
  const cooldownMs = options.cooldownMs ?? 3000;

  let last: { x: number; y: number; z: number } | null = null;
  let jolts: number[] = [];
  let quietUntil = 0;

  const onMotion = (event: DeviceMotionEvent) => {
    const a = event.accelerationIncludingGravity;
    if (!a || a.x === null || a.y === null || a.z === null) return;
    const now = event.timeStamp || performance.now();
    const current = { x: a.x, y: a.y, z: a.z };
    if (last && now >= quietUntil) {
      const delta =
        Math.abs(current.x - last.x) + Math.abs(current.y - last.y) + Math.abs(current.z - last.z);
      if (delta > threshold) {
        jolts = [...jolts.filter((time) => now - time < windowMs), now];
        if (jolts.length >= needed) {
          jolts = [];
          quietUntil = now + cooldownMs;
          onShake();
        }
      }
    }
    last = current;
  };

  window.addEventListener("devicemotion", onMotion, { passive: true });
  return () => window.removeEventListener("devicemotion", onMotion);
}
