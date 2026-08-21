export interface AppInfo {
  bundleId: string;
  isInstalled: boolean;
  versionName?: string;
  versionCode?: number;
}

export interface CapuchooAppsManagerPlugin {
  echo(options: { value: string }): Promise<{ value: string }>;
  /**
   * Get information about an app by its bundle identifier.
   */
  getAppInfo(options: { bundleId: string }): Promise<AppInfo>;

  /**
   * Attempt to open an app by its bundle identifier.
   */
  openApp(options: { bundleId: string }): Promise<{ completed: boolean }>;

  /**
   * Get a list of all installed apps on the device.
   * Note: Requires QUERY_ALL_PACKAGES on Android.
   */
  getInstalledApps(): Promise<{ apps: AppInfo[] }>;
}
