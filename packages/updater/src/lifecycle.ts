import { App } from "@capacitor/app";
import type { PluginListenerHandle } from "@capacitor/core";
import { nativePlugins } from "./optional-plugins.js";

export interface LifecycleHandlers {
  /** The app came back to the foreground, including from the Android installer. */
  onResume: () => void;
  /** The network went from disconnected to connected. */
  onReconnect: () => void;
}

/**
 * Subscribes to app resume and, when `@capacitor/network` is installed, to
 * connectivity. Either subscription failing leaves the other in place; a
 * missing Network plugin only means no reconnect re-check.
 */
export async function watchLifecycle(handlers: LifecycleHandlers): Promise<PluginListenerHandle[]> {
  const handles: PluginListenerHandle[] = [];

  try {
    handles.push(await App.addListener("resume", handlers.onResume));
  } catch (error) {
    console.warn("[capuchoo] could not listen for app resume", error);
  }

  const network = await optionalNetwork();
  if (!network) return handles;

  try {
    let connected = (await network.getStatus()).connected;
    handles.push(
      await network.addListener("networkStatusChange", (status) => {
        const reconnected = status.connected && !connected;
        connected = status.connected;
        if (reconnected) handlers.onReconnect();
      }),
    );
  } catch (error) {
    console.warn("[capuchoo] could not listen for network changes", error);
  }

  return handles;
}

async function optionalNetwork() {
  try {
    return (await nativePlugins.network()).Network;
  } catch {
    return null;
  }
}
