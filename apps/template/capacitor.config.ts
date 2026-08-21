import { KeyboardResize } from "@capacitor/keyboard";
import type { CapacitorConfig } from "@capacitor/cli";
import { capuchoUpdaterConfig } from "@capuchoo/updater/capacitor";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

/**
 * Capacitor configuration.
 *
 * The CLI passes the flavour's variables in as environment when it builds, so
 * this file reads them from `process.env`. The dotenv calls below only cover
 * running Capacitor by hand (`cap run android`), where nothing has injected
 * them.
 */
dotenv.config({ path: path.join(__dirname, ".env.local"), quiet: true });
dotenv.config({ path: path.join(__dirname, ".env"), quiet: true });

const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf8")) as {
  version: string;
};

const isLiveReload = process.env.VITE_LIVE_RELOAD === "true";

const getLiveReloadUrl = (): string | undefined => {
  if (!isLiveReload) return undefined;

  const scheme = process.env.VITE_LIVE_RELOAD_SCHEME ?? "http";
  const host = process.env.VITE_LIVE_RELOAD_HOST ?? "localhost";
  const port = process.env.VITE_LIVE_RELOAD_PORT ?? "5173";

  return `${scheme}://${host}:${port}`;
};

/**
 * `appId` and `appName` have no fallback on purpose.
 *
 * Capacitor writes whatever it finds here into the native project. When these
 * were `process.env.VITE_APP_ID` with no default and the variable was missing,
 * `cap sync` produced a project with an undefined package name rather than
 * failing, which is far harder to notice than an error at this line.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Run the build through "capuchoo deploy", or copy ` +
        `.env.example to .env.local for a manual "cap run".`,
    );
  }
  return value;
}

const config: CapacitorConfig = {
  appId: required("VITE_APP_ID"),
  appName: required("VITE_APP_NAME"),
  webDir: "dist",
  server: {
    url: getLiveReloadUrl(),
    cleartext: isLiveReload,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: "#ffffff",
    },

    Keyboard: {
      resize: KeyboardResize.Native,
      resizeOnFullScreen: true,
    },

    // Built by @capuchoo/updater rather than spelled out here.
    //
    // The previous block set `autoUpdate: true` while the app also called
    // download() and set() itself, so the plugin applied bundles on its own
    // schedule at the same time as the UI was managing them. It also allowed an
    // empty updateUrl, which disables update checks silently. The helper uses
    // "onlyDownload" and refuses to build a config with no URL.
    CapacitorUpdater: capuchoUpdaterConfig({
      apiUrl: required("VITE_UPDATE_API_URL"),
      channel: process.env.VITE_UPDATE_CHANNEL ?? "staging",
      version: packageJson.version,
    }),
  },
};

export default config;
