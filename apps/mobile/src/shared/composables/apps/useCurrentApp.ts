import { getAccount, getApp } from "@/domains/catalog/catalog.repository";
import { getDatabase, useReactiveQuery } from "@/shared/database";
import { currentAppId } from "@/shared/session/currentApp";

/** The app on screen and who is looking at it: what the top bar names. */
export function useCurrentApp() {
  const appId = computed(() => currentAppId.value ?? "");
  const app = useReactiveQuery(() => getApp(getDatabase().db, appId.value), {
    tables: ["app"],
    queryKey: () => ["apps:current", appId.value],
  });
  const account = useReactiveQuery(() => getAccount(getDatabase().db), {
    tables: ["account"],
    queryKey: ["account"],
  });
  return {
    appId,
    app: computed(() => app.data.value ?? null),
    account: computed(() => account.data.value ?? null),
  };
}
