import type { SafeArea } from "@capuchoo/core";

/**
 * What `env(safe-area-inset-*)` resolves to here: how far the status bar, navigation bar and any
 * cutout reach into an app drawn under them. A probe element padded by them is measured once.
 */
export function measureSafeArea(): SafeArea | null {
  if (typeof document === "undefined" || !document.documentElement) return null;
  const probe = document.createElement("div");
  probe.setAttribute("data-capuchoo-ignore", "");
  probe.style.cssText =
    "position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;" +
    "padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)";
  document.documentElement.append(probe);
  try {
    const style = getComputedStyle(probe);
    const px = (value: string) => Number.parseFloat(value) || 0;
    return {
      top: px(style.paddingTop),
      right: px(style.paddingRight),
      bottom: px(style.paddingBottom),
      left: px(style.paddingLeft),
    };
  } finally {
    probe.remove();
  }
}
