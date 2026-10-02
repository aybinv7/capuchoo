const KNOWN: Record<string, string> = {
  get: "Checked for an update",
  check: "Checked for an update",
  app_moved_to_foreground_check: "Checked on foreground",
  set: "Bundle applied",
  install: "Installed",
  download_complete: "Download complete",
  download: "Download started",
  update_available: "Update available",
  app_moved_to_foreground: "App opened",
  app_moved_to_background: "App sent to background",
  uninstall: "Uninstalled",
  cancel: "Cancelled",
  cancelled: "Cancelled",
  skip: "Skipped",
  postpone: "Postponed",
};

const PROGRESS = /^download_(\d+)$/;

/** A readable sentence for an event action; unknown actions are humanised, never hidden. */
export function actionLabel(action: string): string {
  const name = action.trim();
  const known = KNOWN[name.toLowerCase()];
  if (known) return known;
  const progress = PROGRESS.exec(name);
  if (progress) return `Downloading ${progress[1]}%`;
  const words = name.replace(/[_-]+/g, " ").trim();
  if (!words) return "Unnamed event";
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase();
}

/**
 * The version an event moved between: `1.4.1 → 1.4.2 (42)` for a change, the one version when only
 * one is known or both are the same, null when neither is.
 */
export function versionLabel(event: {
  version_from: string | null;
  version_to: string | null;
  version_code_to: number | null;
}): string | null {
  const to = event.version_to
    ? `${event.version_to}${event.version_code_to !== null ? ` (${event.version_code_to})` : ""}`
    : null;
  if (event.version_from && event.version_to && event.version_from !== event.version_to)
    return `${event.version_from} → ${to}`;
  return to ?? event.version_from;
}
