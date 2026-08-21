import { WebPlugin } from "@capacitor/core";

import type { CapuchooAppsManagerPlugin, AppInfo } from "./definitions";

export class CapuchooAppsManagerWeb extends WebPlugin implements CapuchooAppsManagerPlugin {
  async echo(options: { value: string }): Promise<{ value: string }> {
    console.log("ECHO", options);
    return options;
  }

  async getAppInfo(options: { bundleId: string }): Promise<AppInfo> {
    console.warn("CapuchooAppsManager is not available on web", options);
    return {
      bundleId: options.bundleId,
      isInstalled: false,
    };
  }

  async openApp(options: { bundleId: string }): Promise<{ completed: boolean }> {
    console.warn("CapuchooAppsManager is not available on web", options);
    return { completed: false };
  }

  async getInstalledApps(): Promise<{ apps: AppInfo[] }> {
    console.warn("CapuchooAppsManager is not available on web");
    return { apps: [] };
  }
}
