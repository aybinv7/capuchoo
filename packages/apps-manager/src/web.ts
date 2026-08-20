import { WebPlugin } from "@capacitor/core";

import type { capuchoappsmanagerPlugin, AppInfo } from "./definitions";

export class capuchoappsmanagerWeb extends WebPlugin implements capuchoappsmanagerPlugin {
  async echo(options: { value: string }): Promise<{ value: string }> {
    console.log("ECHO", options);
    return options;
  }

  async getAppInfo(options: { bundleId: string }): Promise<AppInfo> {
    console.warn("capuchoappsmanager is not available on web", options);
    return {
      bundleId: options.bundleId,
      isInstalled: false,
    };
  }

  async openApp(options: { bundleId: string }): Promise<{ completed: boolean }> {
    console.warn("capuchoappsmanager is not available on web", options);
    return { completed: false };
  }

  async getInstalledApps(): Promise<{ apps: AppInfo[] }> {
    console.warn("capuchoappsmanager is not available on web");
    return { apps: [] };
  }
}
