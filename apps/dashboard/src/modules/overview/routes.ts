import type { ModuleRoutes } from "@/shared/router/module-routes";
import { RouteName } from "@/shared/router/route-names";

export const overviewRoutes: ModuleRoutes = {
  app: [
    {
      path: "overview",
      name: RouteName.overview,
      component: () => import("./pages/OverviewPage.vue"),
      meta: { title: "Overview", section: "App" },
    },
  ],
};
