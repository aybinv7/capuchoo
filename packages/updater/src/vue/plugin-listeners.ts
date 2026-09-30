import type { PluginListenerHandle } from "@capacitor/core";
import { CapacitorUpdater } from "@capgo/capacitor-updater";
import type { ResolvedUpdate } from "@capuchoo/core";
import { getUpdaterConfig } from "../config.js";
import { publishUpdate } from "./publish-update.js";
import { DONE_PROGRESS, state } from "./updater-state.js";

interface PluginBundle {
  id: string;
  version: string;
  checksum?: string;
}

function asUpdate(bundle: PluginBundle): ResolvedUpdate {
  return {
    kind: "ota",
    version: bundle.version,
    bundleId: bundle.id,
    required: false,
    ...(bundle.checksum ? { checksum: bundle.checksum } : {}),
  };
}

/**
 * Listens to the plugin's own background download (`autoUpdate: "onlyDownload"`).
 * It only ever contributes a downloaded bundle id; an unknown version asks the
 * server, through `recheck`, for the facts the plugin does not carry - whether
 * it is required, and its signature.
 */
export async function attachPluginListeners(recheck: () => void): Promise<PluginListenerHandle[]> {
  const onBundle = (bundle: PluginBundle) => {
    const action = publishUpdate(asUpdate(bundle), "plugin");
    if (action === "replace") recheck();
    return action;
  };

  return Promise.all([
    CapacitorUpdater.addListener("updateAvailable", ({ bundle }) => {
      onBundle(bundle);
    }),

    CapacitorUpdater.addListener("download", ({ percent }) => {
      if (state.value.currentUpdate?.kind !== "ota" || !state.value.downloading) return;
      state.value.progress = { loaded: percent, total: 100, percent };
    }),

    CapacitorUpdater.addListener("downloadComplete", ({ bundle }) => {
      if (onBundle(bundle) !== "ignore" && state.value.downloading) {
        state.value.progress = { ...DONE_PROGRESS };
      }
    }),

    CapacitorUpdater.addListener("downloadFailed", ({ version }) => {
      console.warn("[capuchoo] the plugin could not download", version);
    }),

    CapacitorUpdater.addListener("updateFailed", () => {
      const { appName } = getUpdaterConfig();
      state.value.error = `The update failed, so ${appName} restored the previous version`;
    }),
  ]);
}
