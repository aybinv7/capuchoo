import type { ModuleRoutes } from "@/shared/router/module-routes";
import { RouteName } from "@/shared/router/route-names";

export const devicesRoutes: ModuleRoutes = {
  app: [
    {
      path: "devices",
      name: RouteName.devices,
      component: () => import("./pages/DevicesPage.vue"),
      meta: { title: "Devices", section: "Fleet" },
    },
    {
      path: "devices/:deviceId",
      name: RouteName.device,
      component: () => import("./pages/DeviceDetailPage.vue"),
      meta: { title: "Device", section: "Devices", parent: RouteName.devices },
    },
    {
      path: "activity",
      name: RouteName.activity,
      component: () => import("./pages/ActivityPage.vue"),
      meta: { title: "Activity", section: "Fleet" },
    },
  ],
};
