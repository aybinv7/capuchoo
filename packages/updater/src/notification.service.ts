/**
 * An ongoing notification showing download progress.
 *
 * Opt-in, and silent about its own failures. A download that is allowed to run
 * in the background is invisible otherwise - the app may not even be on screen -
 * and an update that appears to have stalled is one a user cancels.
 *
 * Every failure here is swallowed on purpose. `@capacitor/local-notifications`
 * is an optional peer an app need not install; POST_NOTIFICATIONS is a runtime
 * grant on Android 13+ that the user may refuse; and a channel may not exist.
 * None of that is a reason to fail an update. The notification is a courtesy,
 * and a courtesy that can break the thing it decorates is a defect.
 */

import { Capacitor } from "@capacitor/core";

/** Fixed, so each progress update replaces the last rather than stacking. */
const NOTIFICATION_ID = 8_242_001;

interface LocalNotificationsPlugin {
  schedule(options: { notifications: unknown[] }): Promise<unknown>;
  cancel(options: { notifications: Array<{ id: number }> }): Promise<unknown>;
  requestPermissions?(): Promise<{ display: string }>;
  checkPermissions?(): Promise<{ display: string }>;
}

async function plugin(): Promise<LocalNotificationsPlugin | null> {
  if (Capacitor.getPlatform() === "web") return null;

  try {
    const module = (await import("@capacitor/local-notifications")) as {
      LocalNotifications?: LocalNotificationsPlugin;
    };
    return module.LocalNotifications ?? null;
  } catch {
    // Not installed. An app that never backgrounds a download has no use for it.
    return null;
  }
}

/**
 * Asks for permission once, and reports whether progress can be shown.
 *
 * Called before the first notification rather than at start-up: an app that
 * never downloads an update should never ask for a notification permission it
 * will not use, and a permission prompt out of context is one people decline.
 */
export async function canNotify(): Promise<boolean> {
  const notifications = await plugin();
  if (!notifications) return false;

  try {
    const current = await notifications.checkPermissions?.();
    if (current?.display === "granted") return true;

    const asked = await notifications.requestPermissions?.();
    return asked?.display === "granted";
  } catch {
    return false;
  }
}

export interface ProgressNotification {
  title: string;
  /** 0-100. */
  percent: number;
  body?: string;
}

/**
 * Shows or replaces the progress notification.
 *
 * `ongoing` keeps it undismissable while the download runs, which is what stops
 * someone swiping it away and then wondering whether anything is happening.
 */
export async function showProgress(input: ProgressNotification): Promise<void> {
  const notifications = await plugin();
  if (!notifications) return;

  try {
    await notifications.schedule({
      notifications: [
        {
          id: NOTIFICATION_ID,
          title: input.title,
          body: input.body ?? `${input.percent}%`,
          ongoing: true,
          autoCancel: false,
          // Android renders these as a determinate progress bar; iOS ignores
          // them, which is correct - it has no equivalent and a fake one would
          // be worse than none.
          extra: { progress: input.percent, progressMax: 100 },
        },
      ],
    });
  } catch {
    // See the module comment: never fail an update for a notification.
  }
}

/** Removes it. Called on completion, on failure, and on cancellation alike. */
export async function clearProgress(): Promise<void> {
  const notifications = await plugin();
  if (!notifications) return;

  try {
    await notifications.cancel({ notifications: [{ id: NOTIFICATION_ID }] });
  } catch {
    // A notification that outlives its download is untidy, not broken.
  }
}
