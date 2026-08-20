import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";
import { useUpdater } from "@capucho/updater/vue";
import type Framework7 from "framework7";

/**
 * Capacitor bootstrap.
 *
 * The updater is wired here rather than through a `useAppUpdater` wrapper: that
 * wrapper registered an `App.addListener("resume")` handler and never removed
 * it, so a second init stacked duplicate listeners, each firing its own update
 * check against the same shared state.
 */
const listeners: PluginListenerHandle[] = [];
let initialised = false;

const capacitor = {
  f7: null as Framework7 | null,

  async init(f7: Framework7): Promise<void> {
    capacitor.f7 = f7;

    // None of this has a web implementation worth running.
    if (!Capacitor.isNativePlatform() || initialised) return;
    initialised = true;

    useAndroidBackButton(f7);
    useSplashscreen();
    useKeyboard(f7);
    await useStatusBar(f7);

    const updater = useUpdater();
    await updater.init();

    listeners.push(
      // A resume is the most reliable moment to notice a new release: the app
      // has been backgrounded long enough for one to have been published.
      await App.addListener("resume", () => {
        void updater.check(true);
      }),
    );
  },

  async cleanup(): Promise<void> {
    await Promise.all(listeners.splice(0).map((listener) => listener.remove()));
    await useUpdater().cleanup();
    initialised = false;
  },
};

export default capacitor;
