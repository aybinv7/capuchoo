import {
  listActivity,
  markAllRead,
  type ActivityRow,
} from "@/domains/activity/activity.repository";
import { getDatabase, rdb, useReactiveQuery } from "@/shared/database";
import { notificationsAllowed, requestNotifications } from "@/shared/notify/notify";
import { currentAppId } from "@/shared/session/currentApp";
import { formatDay } from "@/shared/utils/format";

export interface ActivityDay {
  label: string;
  rows: ActivityRow[];
}

export function groupByDay(rows: ActivityRow[], locale: string, now = new Date()): ActivityDay[] {
  const days: ActivityDay[] = [];
  for (const row of rows) {
    const label = formatDay(row.created_at, locale, now);
    const last = days[days.length - 1];
    if (last?.label === label) last.rows.push(row);
    else days.push({ label, rows: [row] });
  }
  return days;
}

export function useActivityFeed() {
  const { locale } = useI18n();
  const appId = computed(() => currentAppId.value ?? "");
  const query = useReactiveQuery(() => listActivity(getDatabase().db, appId.value), {
    tables: ["activity", "app"],
    queryKey: () => ["activity:feed", appId.value],
    debounce: 100,
  });

  const days = computed(() => groupByDay(query.data.value ?? [], locale.value));
  const unread = computed(() => (query.data.value ?? []).filter((row) => !row.read_at).length);

  const notificationsOn = ref(true);
  async function checkNotifications(): Promise<void> {
    notificationsOn.value = await notificationsAllowed().catch(() => false);
  }
  async function enableNotifications(): Promise<void> {
    notificationsOn.value = await requestNotifications().catch(() => false);
  }

  async function readAll(): Promise<void> {
    await markAllRead(rdb, new Date().toISOString(), appId.value || undefined);
  }

  return {
    days,
    unread,
    loading: query.loading,
    notificationsOn,
    checkNotifications,
    enableNotifications,
    readAll,
  };
}
