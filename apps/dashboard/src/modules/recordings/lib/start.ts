import { Bug, Code2, Hand, Radio, Vibrate, type LucideIcon } from "@lucide/vue";
import type { LaneTone } from "./tones";

export interface StartStyle {
  label: string;
  description: string;
  icon: LucideIcon;
  tone: LaneTone;
}

const STARTS: Record<string, StartStyle> = {
  shake: {
    label: "Shake report",
    description: "The user shook the device to report a problem.",
    icon: Vibrate,
    tone: "primary",
  },
  manual: {
    label: "Report",
    description: "The user reported a problem from the app.",
    icon: Hand,
    tone: "primary",
  },
  error: {
    label: "Error",
    description: "An uncaught error raised the recording.",
    icon: Bug,
    tone: "danger",
  },
  app: {
    label: "App",
    description: "The app's own code raised the recording.",
    icon: Code2,
    tone: "info",
  },
  policy: {
    label: "Policy",
    description: "Recorded because the rules asked this device to.",
    icon: Radio,
    tone: "muted",
  },
};

export const START_KINDS = Object.keys(STARTS);

export const startStyle = (start: string): StartStyle => STARTS[start] ?? STARTS.policy!;
