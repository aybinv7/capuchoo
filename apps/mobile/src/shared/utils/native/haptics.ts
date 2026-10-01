import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

/** A light tick for a small moment - a tapback landing. Silent off-device and never throws. */
export function tick(): void {
  if (!Capacitor.isNativePlatform()) return;
  Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
}

/** A firmer bump for a bigger one - a surprise message arriving. */
export function bump(): void {
  if (!Capacitor.isNativePlatform()) return;
  Haptics.impact({ style: ImpactStyle.Medium }).catch(() => undefined);
}
