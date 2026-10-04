import type { SafeArea } from "@capuchoo/core";

/**
 * `env(safe-area-inset-*)` and the older `constant(...)`, with or without a fallback. A fallback
 * holding its own parentheses (`calc(...)`) is matched one level deep, which is all CSS uses here.
 */
const INSET =
  /(?:env|constant)\(\s*safe-area-inset-(top|right|bottom|left)\s*(?:,(?:[^()]|\([^()]*\))*)?\)/g;

/**
 * CSS as the phone resolved it: every safe-area inset replaced by the pixels the device reported.
 * Outside the phone they resolve to 0, which draws an app laid out under the status bar higher than
 * it was - and puts an agent's tap that much higher than where they pointed.
 */
export function withSafeArea(css: string, safeArea: SafeArea | null | undefined): string {
  if (!safeArea || !css.includes("safe-area-inset")) return css;
  return css.replace(INSET, (_match, side: keyof SafeArea) => `${safeArea[side]}px`);
}
