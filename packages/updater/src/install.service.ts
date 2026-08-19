import { Capacitor } from "@capacitor/core";
import { FileOpener } from "@capawesome-team/capacitor-file-opener";
import { getUpdaterConfig } from "./config.js";

const APK_MIME = "application/vnd.android.package-archive";

/**
 * Hands a downloaded APK to the Android package installer.
 *
 * Requires `REQUEST_INSTALL_PACKAGES` in the manifest - the Trapeze config for
 * each flavour merges it in - and the user must have allowed this app to
 * install unknown apps. Both failures surface as opaque platform errors, so
 * they are translated into something a user can act on.
 */
export async function openNativeInstaller(path: string): Promise<void> {
  if (Capacitor.getPlatform() !== "android") {
    throw new Error(
      "Installing a native update from inside the app is only possible on Android. " +
        "On iOS the update has to come from the App Store or TestFlight.",
    );
  }

  try {
    await FileOpener.openFile({ path, mimeType: APK_MIME });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const { appName } = getUpdaterConfig();

    if (/permission|unknown sources|REQUEST_INSTALL_PACKAGES/i.test(message)) {
      throw new Error(
        `Allow ${appName} to install unknown apps in Android settings, then try again`,
      );
    }
    if (/activity|no app/i.test(message)) {
      throw new Error(
        "No package installer is available on this device, so the update cannot be installed here",
      );
    }

    throw new Error(`Could not open the Android installer: ${message}`);
  }
}
