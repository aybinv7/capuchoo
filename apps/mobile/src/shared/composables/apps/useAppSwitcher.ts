import { currentAppId, selectApp } from "@/shared/session/currentApp";
import { syncInsights } from "@/shared/sync/insights";
import { tick } from "@/shared/utils/native/haptics";

const opened = ref(false);

/** The switcher is one sheet for the whole shell; any top bar opens it. */
export function useAppSwitcher() {
  function open(): void {
    tick();
    opened.value = true;
  }

  function close(): void {
    opened.value = false;
  }

  /** The shell re-keys on the new app, so every tab starts over on it. */
  function choose(appId: string): void {
    opened.value = false;
    if (appId === currentAppId.value) return;
    selectApp(appId);
    void syncInsights(appId).catch(() => undefined);
  }

  return { opened, open, close, choose };
}
