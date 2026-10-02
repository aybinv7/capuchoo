export type LaneTone = "success" | "warning" | "info" | "muted";

/** The one-line verdict under a lane node's value. */
export interface LaneStatus {
  tone: LaneTone;
  text: string;
}
