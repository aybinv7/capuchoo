import type { Adb } from "./adb.ts";

export interface LaunchTiming {
  /** `am start -W` TotalTime: from the intent to the first frame of the activity. */
  totalTimeMs: number | null;
  waitTimeMs: number | null;
}

const field = (output: string, name: string) => {
  const match = new RegExp(`${name}:\\s*(\\d+)`).exec(output);
  return match ? Number(match[1]) : null;
};

/** The app under test: start, stop, find its processes, and reset what it stored in the WebView. */
export function createApp(adb: Adb, packageName: string) {
  let activity: string | null = null;

  async function launcherActivity(): Promise<string> {
    if (activity) return activity;
    const resolved = (
      await adb.shell(
        `cmd package resolve-activity --brief -c android.intent.category.LAUNCHER ${packageName}`,
      )
    )
      .trim()
      .split(/\r?\n/)
      .pop();
    if (!resolved?.includes("/")) throw new Error(`No launcher activity for ${packageName}`);
    activity = resolved.trim();
    return activity;
  }

  async function pids(processName: string): Promise<number[]> {
    const output = (await adb.shell(`pidof ${processName}`).catch(() => "")).trim();
    return output ? output.split(/\s+/).map(Number).filter(Number.isInteger) : [];
  }

  return {
    packageName,

    async stop(): Promise<void> {
      await adb.shell(`am force-stop ${packageName}`);
    },

    /** A cold start: the process is stopped first, so nothing is reused from a previous run. */
    async coldStart(): Promise<LaunchTiming> {
      await adb.shell(`am force-stop ${packageName}`);
      const output = await adb.shell(`am start -W -n ${await launcherActivity()}`, 90_000);
      return { totalTimeMs: field(output, "TotalTime"), waitTimeMs: field(output, "WaitTime") };
    },

    async mainPid(): Promise<number | null> {
      return (await pids(packageName))[0] ?? null;
    },

    /**
     * The WebView renderer the app bound. It runs as an isolated process outside the app's own, and
     * holds the page, the recorder's worker and the database, so it is measured separately.
     */
    async rendererPid(): Promise<number | null> {
      const services = await adb.shell(`dumpsys activity services ${packageName}`);
      const pattern = /app=ProcessRecord\{[0-9a-f]+ (\d+):[^}]*sandboxed_process/g;
      const found = [...services.matchAll(pattern)].map((match) => Number(match[1]));
      return found.length ? Math.max(...found) : null;
    },

    /**
     * Clears what the app keeps in the WebView: localStorage, the OPFS database, IndexedDB and caches.
     * The native side (the updater's device id, its bundles) is kept, so the device stays the same
     * device to the server and its per-device recording rule keeps applying.
     */
    async clearWebViewData(): Promise<void> {
      await adb.shell(`am force-stop ${packageName}`);
      await adb.shell(`run-as ${packageName} rm -rf app_webview cache code_cache`);
    },

    /** Whether this app is the one in front, so a tap never lands in another app. */
    async isForeground(): Promise<boolean> {
      const output = await adb.shell("dumpsys window | grep -E 'mCurrentFocus|mFocusedApp'");
      return output.includes(`${packageName}/`);
    },
  };
}

export type App = ReturnType<typeof createApp>;
