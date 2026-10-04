import type { Tone } from "@/shared/lib/tone";

export type LaneTone = Tone | "primary";

export const TONE_TEXT: Record<LaneTone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
  info: "text-info",
  muted: "text-muted-foreground",
  primary: "text-primary",
};

export const TONE_SOFT: Record<LaneTone, string> = {
  success: "bg-success-soft",
  warning: "bg-warning-soft",
  danger: "bg-danger-soft",
  info: "bg-info-soft",
  muted: "bg-muted",
  primary: "bg-primary/10",
};

/** For SVG fills, where Tailwind classes do not reach. */
export const TONE_COLOR: Record<LaneTone, string> = {
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--destructive)",
  info: "var(--info)",
  muted: "var(--muted-foreground)",
  primary: "var(--primary)",
};
