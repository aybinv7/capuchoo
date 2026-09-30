import type { BuildStatus, BuildStepStatus } from "../types/build";

export type Tone = "success" | "warning" | "danger" | "info" | "muted";

export function buildTone(status: BuildStatus | BuildStepStatus): Tone {
  switch (status) {
    case "succeeded":
      return "success";
    case "failed":
      return "danger";
    case "running":
    case "queued":
      return "info";
    case "cancelled":
    case "skipped":
      return "warning";
    default:
      return "muted";
  }
}

export const isBuildActive = (status: BuildStatus) => status === "running" || status === "queued";
