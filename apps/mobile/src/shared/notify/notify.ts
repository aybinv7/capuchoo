import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { i18n } from "@/plugins/i18n.plugin";
import type { ActivityTable } from "@/shared/database/schema";

let foreground = true;
let tracking = false;

/** Whether the app is on screen; a notification is for when it is not. */
export async function trackForeground(): Promise<void> {
  if (tracking || !Capacitor.isNativePlatform()) return;
  tracking = true;
  await CapacitorApp.addListener("appStateChange", ({ isActive }) => {
    foreground = isActive;
  });
}

export function activityTitle(
  row: Pick<ActivityTable, "kind" | "version_name" | "version_code" | "channel_name">,
  appName: string,
): string {
  const t = i18n.global.t;
  const version = row.version_name ? `${row.version_name} (${row.version_code ?? "?"})` : "";
  return t(`activity.kind.${row.kind}`, { app: appName, version, channel: row.channel_name ?? "" });
}

export async function notificationsAllowed(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  const status = await LocalNotifications.checkPermissions();
  return status.display === "granted";
}

export async function requestNotifications(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  const status = await LocalNotifications.requestPermissions();
  return status.display === "granted";
}

/**
 * Posts what happened while the app was in the background, one notification per app so a burst
 * of builds is one line in the shade. The server has no push channel, so this runs only while the
 * app's process is alive; the Activity tab is the full record either way.
 */
export async function notifyActivity(
  rows: ActivityTable[],
  appNames: Map<string, { name: string; notify: number }>,
): Promise<void> {
  if (foreground || rows.length === 0 || !(await notificationsAllowed())) return;
  const byApp = new Map<string, ActivityTable[]>();
  for (const row of rows) {
    const app = appNames.get(row.app_id);
    if (!app?.notify) continue;
    byApp.set(row.app_id, [...(byApp.get(row.app_id) ?? []), row]);
  }

  const notifications = [...byApp].map(([appId, list], index) => {
    const app = appNames.get(appId)!;
    const latest = list[list.length - 1]!;
    return {
      id: (Date.now() % 1_000_000_000) + index,
      title: app.name,
      body:
        list.length === 1
          ? activityTitle(latest, app.name)
          : i18n.global.t("activity.many", {
              count: list.length,
              latest: activityTitle(latest, app.name),
            }),
      extra: { appId },
      group: "capuchoo-activity",
    };
  });
  if (notifications.length) await LocalNotifications.schedule({ notifications });
}
