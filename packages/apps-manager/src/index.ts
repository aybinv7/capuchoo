import { registerPlugin } from "@capacitor/core";

import type { CapuchooAppsManagerPlugin } from "./definitions";

const CapuchooAppsManager = registerPlugin<CapuchooAppsManagerPlugin>("CapuchooAppsManager", {
  web: () => import("./web").then((m) => new m.CapuchooAppsManagerWeb()),
});

export * from "./definitions";
export { CapuchooAppsManager };
