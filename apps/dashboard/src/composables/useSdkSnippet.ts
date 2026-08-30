import { computed, type MaybeRefOrGetter, toValue } from "vue";

/**
 * The configuration snippet the dashboard hands to a developer.
 *
 * One source, because there were three and each was wrong in a different way -
 * on the overview, on the app page, and on the channel page. A snippet that is
 * copied into someone's project is not decoration; it is the first thing they
 * run, and it decides whether their app updates at all.
 *
 * What the three said, and why each was wrong:
 *
 *   const apiBase = window.location.origin.replace(/:\d+$/, ":3000") + "/api";
 *
 * The *dashboard's* origin with the port swapped to 3000. Correct only when the
 * dashboard is on localhost and the backend is beside it. Copied from the
 * deployed dashboard it produced `https://capuchoo-front.onrender.com/api`,
 * which is the static site, not the API.
 *
 *   autoUpdate: true
 *
 * Directly against the rule this project keeps: `autoUpdate` must be
 * "onlyDownload" or false when the app drives its own updates, and `true` means
 * the plugin and the app both apply bundles. The channel page's version had no
 * URLs at all and put `appId` inside the plugin block, where nothing reads it.
 *
 * All three also hand-wrote the plugin block instead of calling
 * `capuchooUpdaterConfig`, which is the supported path - it validates the
 * values, refuses to build when they are missing rather than shipping an app
 * with updates silently disabled, and appends `/api/...` itself.
 */

/**
 * The backend origin, without the `/api` suffix the API client needs.
 *
 * `capuchooUpdaterConfig` appends `/api/update` and `/api/stats` itself, so a
 * base that already ends in `/api` yields `/api/api/update` - which is not a
 * 404 but a 401 from the authenticated dashboard routes, and the plugin treats
 * 401 as permanent. That cost a day: every update check and every statistic a
 * real device produced was dropped while the app appeared to work.
 */
export function backendOrigin(): string {
  const configured = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

  return String(configured)
    .replace(/\/+$/, "")
    .replace(/\/api$/i, "");
}

export function useSdkSnippet(
  appId: MaybeRefOrGetter<string | undefined>,
  channel: MaybeRefOrGetter<string | undefined> = "prod",
) {
  const snippet = computed(() => {
    const id = toValue(appId) || "com.example.app";
    const name = toValue(channel) || "prod";

    return `// capacitor.config.ts
import { capuchooUpdaterConfig } from "@capuchoo/updater/capacitor";
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "${id}",
  webDir: "dist",
  plugins: {
    CapacitorUpdater: capuchooUpdaterConfig({
      apiUrl: process.env.VITE_UPDATE_API_URL,
      channel: process.env.VITE_UPDATE_CHANNEL,
    }),
  },
};

export default config;`;
  });

  /**
   * The two variables the snippet reads.
   *
   * Given separately because they belong in the flavour's env file, not in a
   * committed config: reading them through `process.env` is what lets one
   * project build dev, staging and prod from the same source. Hard-coding the
   * URL is how an app ends up pointing at the wrong server after a rename.
   */
  const env = computed(
    () => `VITE_UPDATE_API_URL=${backendOrigin()}
VITE_UPDATE_CHANNEL=${toValue(channel) || "prod"}`,
  );

  return { snippet, env };
}
