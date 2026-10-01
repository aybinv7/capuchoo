import { Capacitor } from "@capacitor/core";
import { Style, StatusBar } from "@capacitor/status-bar";

/**
 * The bar is transparent and overlays the web view, so the page owns the space behind it - see the
 * safe-area padding in `assets/css/app.css`. Style follows the theme, because a dark bar over a
 * dark header renders invisible text.
 */
export async function useStatusBar(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  await StatusBar.setOverlaysWebView({ overlay: true });
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  await StatusBar.setStyle({ style: prefersDark ? Style.Dark : Style.Light });
}
