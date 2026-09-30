import type { ModuleRoutes } from "@/shared/router/module-routes";
import { RouteName } from "@/shared/router/route-names";

export const buildsRoutes: ModuleRoutes = {
  app: [
    {
      path: "builds",
      name: RouteName.builds,
      component: () => import("./pages/BuildsPage.vue"),
      meta: { title: "Builds", section: "Release" },
    },
    {
      path: "builds/:buildId",
      name: RouteName.build,
      component: () => import("./pages/BuildDetailPage.vue"),
      meta: { title: "Build", section: "Builds" },
    },
  ],
};
