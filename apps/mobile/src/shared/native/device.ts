import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export interface PackageState {
  packageName: string;
  installed: boolean;
  versionName?: string;
  versionCode?: number;
  lastUpdateTime?: number;
  /** SHA-256 of the installed build's signing certificate, lowercase hex. */
  signingCertSha256?: string;
}

export interface DownloadResult {
  path: string;
  bytes: number;
  sha256: string;
  packageName: string;
  versionName: string;
  versionCode: number;
  signingCertSha256?: string;
}

export interface DownloadProgress {
  key: string;
  bytes: number;
  total: number;
}

export type InstallStatus = "pending_user" | "success" | "failure" | "aborted" | "conflict";

export interface InstallEvent {
  packageName: string;
  status: InstallStatus;
  message?: string;
}

export interface StreamMessage {
  key: string;
  event: string;
  data: string;
}

export interface StreamState {
  key: string;
  state: "open" | "closed" | "retrying";
  message?: string;
}

/**
 * `CapuchooDevice`, implemented in `android/app/src/main/java/.../CapuchooDevicePlugin.kt`. Native,
 * because each of these is something a WebView cannot do: read other apps' package info, stream an
 * APK to disk while hashing it, hand it to PackageInstaller, and hold an authenticated SSE stream
 * (EventSource cannot send an Authorization header).
 */
interface CapuchooDevicePlugin {
  packages(options: { packageNames: string[] }): Promise<{ packages: PackageState[] }>;
  open(options: { packageName: string }): Promise<{ opened: boolean }>;
  download(options: { key: string; url: string; expectedSha256?: string }): Promise<DownloadResult>;
  cancelDownload(options: { key: string }): Promise<void>;
  install(options: { path: string }): Promise<void>;
  /** Resolves once the system's uninstall screen closes, with whether the app is gone. */
  uninstall(options: { packageName: string }): Promise<{ uninstalled: boolean }>;
  canInstall(): Promise<{ allowed: boolean }>;
  openInstallSettings(): Promise<void>;
  clearDownloads(): Promise<void>;
  openStream(options: { key: string; url: string; token: string }): Promise<void>;
  closeStream(options: { key: string }): Promise<void>;
  addListener(
    event: "downloadProgress",
    listener: (event: DownloadProgress) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    event: "installStatus",
    listener: (event: InstallEvent) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    event: "streamMessage",
    listener: (event: StreamMessage) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    event: "streamState",
    listener: (event: StreamState) => void,
  ): Promise<PluginListenerHandle>;
}

export const CapuchooDevice = registerPlugin<CapuchooDevicePlugin>("CapuchooDevice");

/** The plugin exists only in the Android build; the browser renders the same screens without it. */
export const hasDevice = (): boolean => Capacitor.getPlatform() === "android";
