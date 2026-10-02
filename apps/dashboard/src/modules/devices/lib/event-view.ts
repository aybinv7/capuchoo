import { Ban, CircleCheck, CircleDashed, CircleX, Download, Power, RefreshCw } from "@lucide/vue";
import type { Component } from "vue";
import type { DeviceEventCategory } from "../types/devices.types";

export interface CategoryView {
  label: string;
  icon: Component;
  /** Icon colour on its soft background. */
  tone: string;
}

export const CATEGORY_VIEW: Record<DeviceEventCategory, CategoryView> = {
  delivered: { label: "Delivered", icon: CircleCheck, tone: "text-success bg-success-soft" },
  failed: { label: "Failed", icon: CircleX, tone: "text-destructive bg-danger-soft" },
  downloading: { label: "Downloading", icon: Download, tone: "text-info bg-info-soft" },
  check: { label: "Check", icon: RefreshCw, tone: "text-muted-foreground bg-muted" },
  cancelled: { label: "Cancelled", icon: Ban, tone: "text-warning bg-warning-soft" },
  lifecycle: { label: "Lifecycle", icon: Power, tone: "text-muted-foreground bg-muted" },
  other: { label: "Other", icon: CircleDashed, tone: "text-muted-foreground bg-muted" },
};
