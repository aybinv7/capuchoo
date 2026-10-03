import {
  Activity,
  Database,
  Flag,
  Globe,
  type LucideIcon,
  MapPin,
  SquareTerminal,
  Pointer,
} from "@lucide/vue";
import type { ActivityItem } from "../../lib/activity";

export const LANE_ICONS: Record<ActivityItem["lane"], LucideIcon> = {
  console: SquareTerminal,
  network: Globe,
  database: Database,
  telemetry: Activity,
  marker: Flag,
  step: Pointer,
};

export const MARKER_ICON = MapPin;

export function statusTone(status: number | null, error: string | null): string {
  if (error || status === null) return "bg-danger-soft text-destructive";
  if (status >= 500) return "bg-danger-soft text-destructive";
  if (status >= 400) return "bg-warning-soft text-warning";
  if (status >= 300) return "bg-info-soft text-info";
  return "bg-success-soft text-success";
}

export function pathOf(raw: string): string {
  try {
    const url = new URL(raw);
    return `${url.pathname}${url.search}`;
  } catch {
    return raw;
  }
}

export function hostOf(raw: string): string {
  try {
    return new URL(raw).host;
  } catch {
    return "";
  }
}
