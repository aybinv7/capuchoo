import { INSTALL_PERMISSION } from "./wiring.js";

/**
 * The calls that check for an update and apply it. `notifyAppReady()` only confirms the running
 * bundle; under `autoUpdate: "onlyDownload"` the plugin downloads and never switches, so an app
 * holding none of these receives every update and shows none.
 */
const APPLYING_CALLS = [
  "useUpdatePrompt",
  "useUpdater",
  "applyOtaUpdate",
  "checkForUpdate",
] as const;

export function appliesUpdates(sources: string): boolean {
  return APPLYING_CALLS.some((call) => sources.includes(call));
}

/** Names only: the ranges are init's to choose, this check only says what is absent. */
export const NATIVE_INSTALL_PACKAGES = [
  "@capacitor/file-transfer",
  "@capacitor/filesystem",
  "@capacitor/network",
  "@capacitor/local-notifications",
  "@capawesome-team/capacitor-file-opener",
] as const;

export interface NativeInstallFacts {
  dependencies: Readonly<Record<string, string>>;
  /** Null when the Android project has not been generated. */
  manifest: string | null;
  /** Channels currently serving an APK, which only an in-app install can deliver to a sideloaded device. */
  nativeChannels: readonly string[];
}

export interface NativeInstallState {
  /** Whether the app means to install APKs itself. */
  intended: boolean;
  missingPackages: string[];
  missingPermission: boolean;
}

/**
 * The file opener alone is not intent: apps use it to open their own documents. The downloader,
 * or a channel already serving an APK, is.
 */
export function assessNativeInstall(facts: NativeInstallFacts): NativeInstallState {
  const intended =
    "@capacitor/file-transfer" in facts.dependencies || facts.nativeChannels.length > 0;

  if (!intended) return { intended, missingPackages: [], missingPermission: false };

  return {
    intended,
    missingPackages: NATIVE_INSTALL_PACKAGES.filter((name) => !(name in facts.dependencies)),
    missingPermission: facts.manifest !== null && !facts.manifest.includes(INSTALL_PERMISSION),
  };
}
