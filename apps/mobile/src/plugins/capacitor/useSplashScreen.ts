import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";

/**
 * `launchAutoHide` is off in `capacitor.config.ts`, so the splash stays up until this is called.
 * Hiding it on a frame boundary avoids a flash of an unpainted shell between the two.
 */
export function hideSplashScreen(): void {
  if (!Capacitor.isNativePlatform()) return;
  requestAnimationFrame(() => void SplashScreen.hide());
}
