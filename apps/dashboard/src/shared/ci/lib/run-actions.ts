import type { CiRunAction } from "@capuchoo/core";

export interface RunActionInfo {
  action: CiRunAction;
  label: string;
  summary: string;
  detail: string;
}

/** What each action does, in the order the dialog offers them. */
export const RUN_ACTIONS: readonly RunActionInfo[] = [
  {
    action: "ota",
    label: "Publish OTA",
    summary: "Build the web bundle and publish it",
    detail:
      "Builds the web app, signs the bundle and uploads it to the channel. Devices on that channel pick it up on their next update check.",
  },
  {
    action: "native",
    label: "Build native",
    summary: "Build and attach an Android release",
    detail:
      "Builds an APK on the runner and attaches it to the channel. A release build needs the Android signing secrets in the repository.",
  },
  {
    action: "check",
    label: "Rehearse",
    summary: "Run every step, upload nothing",
    detail:
      "Runs the whole deploy with --dry-run: resolves the configuration, builds and bundles, and stops before the upload. No channel changes.",
  },
  {
    action: "deliver",
    label: "Deliver to a client",
    summary: "Point a client at a prod version",
    detail:
      "Points prod-<client> at a version prod already serves. Nothing is built; the client's devices update on their next check.",
  },
];

export const runActionInfo = (action: CiRunAction): RunActionInfo =>
  RUN_ACTIONS.find((entry) => entry.action === action) ?? RUN_ACTIONS[0]!;
