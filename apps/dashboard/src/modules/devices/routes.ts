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
  ],
};
