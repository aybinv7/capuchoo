import type { ModuleRoutes } from "@/shared/router/module-routes";
import { RouteName } from "@/shared/router/route-names";

export const appsRoutes: ModuleRoutes = {
  workspace: [
    {
      path: "apps",
      name: RouteName.apps,
      component: () => import("./pages/AppsPage.vue"),
      meta: { title: "Apps" },
    },
  ],
};
