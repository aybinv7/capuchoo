import { computed } from "vue";
import { useUpdater } from "./useUpdater.js";

/**
 * Derives everything an update prompt needs to render, so each app only writes
 * the markup for its own design system.
 *
 * The styled component itself stays in the app on purpose: this package would
 * otherwise have to ship a Framework7 dialog to one app and something else to
 * the next, and a component library is not what makes updates work. The state
 * machine is the reusable part.
 */
export function useUpdatePrompt() {
  const updater = useUpdater();

  const update = updater.currentUpdate;
  const isNativeUpdate = computed(() => update.value?.kind === "native");

  return {
    ...updater,

    /**
     * Whether the prompt should be on screen at all.
     *
     * True for errors as well as updates, so a failed check is not silent - but
     * only useful to a component that renders `title` and `body` from here. A
     * dialog with its own copy ("New version available") must bind to
     * `updateAvailable` instead, or an unreachable server is announced to users
     * as a release with a blank version number. That happened in a real app.
     */
    visible: computed(() => updater.updateAvailable.value || updater.error.value !== null),

    title: computed(() => {
      if (updater.error.value) return "Update problem";
      if (!update.value) return "";
      return update.value.required ? "Update required" : "Update available";
    }),

    subtitle: computed(() => {
      if (!update.value) return "";
      const kind = isNativeUpdate.value ? "app version" : "update";
      return `Version ${update.value.version} - ${kind}`;
    }),

    body: computed(() => updater.error.value ?? update.value?.releaseNotes ?? ""),

    /**
     * Where the update is in its lifecycle, for an app that writes its own copy.
     *
     * `primaryLabel` below bakes in English, so a localised app cannot use it
     * and writes a fixed string instead - which is how efficy's dialog ended up
     * reading "Mettre a jour maintenant" through a 45 MB download and then
     * again while waiting for a second tap, with nothing on screen changing.
     * Switch on this and supply your own wording.
     *
     * `downloaded` only happens for a native update: the APK is on disk and the
     * next press hands it to the system installer. An OTA bundle applies itself,
     * so it never rests here.
     */
    phase: computed<"idle" | "downloading" | "downloaded" | "installing">(() => {
      if (updater.isInstalling.value) return "installing";
      if (updater.isDownloading.value) return "downloading";
      if (isNativeUpdate.value && updater.cachedPath.value) return "downloaded";
      return "idle";
    }),

    /**
     * Native updates need a download step and then an install step; OTA
     * updates apply themselves once downloaded.
     */
    primaryLabel: computed(() => {
      if (updater.isDownloading.value) return "Downloading...";
      if (updater.isInstalling.value) return "Installing...";
      if (isNativeUpdate.value && updater.cachedPath.value) return "Install now";
      if (isNativeUpdate.value) return "Download";
      return "Update now";
    }),

    primaryAction: () =>
      isNativeUpdate.value && updater.cachedPath.value
        ? updater.installNativeUpdate()
        : updater.startDownload(),

    /** Busy state - the primary button must be disabled. */
    busy: computed(() => updater.isDownloading.value || updater.isInstalling.value),

    /** A required update cannot be postponed, and neither can one mid-flight. */
    dismissible: computed(
      () =>
        !updater.isRequired.value && !updater.isDownloading.value && !updater.isInstalling.value,
    ),

    showProgress: computed(() => updater.isDownloading.value && updater.progress.value.percent > 0),
  };
}
