import { countUnread } from "@/domains/activity/activity.repository";
import { getDatabase, useReactiveQuery } from "@/shared/database";
import { currentAppId } from "@/shared/session/currentApp";

/** Unread activity for the app on screen, capped the way a badge shows it. */
export function useUnreadCount() {
  const appId = computed(() => currentAppId.value ?? "");
  const query = useReactiveQuery(() => countUnread(getDatabase().db, appId.value), {
    tables: ["activity"],
    queryKey: () => ["activity:unread", appId.value],
  });
  const count = computed(() => query.data.value ?? 0);
  const badge = computed(() => (count.value > 99 ? "99+" : count.value || ""));
  return { count, badge };
}
