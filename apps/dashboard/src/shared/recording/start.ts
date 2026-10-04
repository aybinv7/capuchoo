import { Bug, Code2, Hand, Radio, Vibrate, type LucideIcon } from "@lucide/vue";
import type { LaneTone } from "@/shared/lib/tone-styles";

export interface StartStyle {
  label: string;
  description: string;
  icon: LucideIcon;
  tone: LaneTone;
  /** A chart colour of its own, where two kinds share a badge tone. */
  color: string;
}

const STARTS: Record<string, StartStyle> = {
  shake: {
    label: "Shake report",
    description: "The user shook the device to report a problem.",
    icon: Vibrate,
    tone: "primary",
    color: "var(--primary)",
  },
  manual: {
    label: "Report",
    description: "The user reported a problem from the app.",
    icon: Hand,
    tone: "primary",
    color: "var(--warning)",
  },
  error: {
    label: "Error",
    description: "An uncaught error raised the recording.",
    icon: Bug,
    tone: "danger",
    color: "var(--destructive)",
  },
  app: {
    label: "App",
    description: "The app's own code raised the recording.",
    icon: Code2,
    tone: "info",
    color: "var(--info)",
  },
  policy: {
    label: "Policy",
    description: "Recorded because the rules asked this device to.",
    icon: Radio,
    tone: "muted",
    color: "var(--muted-foreground)",
  },
};

export const START_KINDS = Object.keys(STARTS);

export const startStyle = (start: string): StartStyle => STARTS[start] ?? STARTS.policy!;
