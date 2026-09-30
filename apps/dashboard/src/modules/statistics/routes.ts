import type { ModuleRoutes } from "@/shared/router/module-routes";
import { RouteName } from "@/shared/router/route-names";

export const statisticsRoutes: ModuleRoutes = {
  app: [
    {
      path: "statistics",
      name: RouteName.statistics,
      component: () => import("./pages/StatisticsPage.vue"),
      meta: { title: "Statistics", section: "Fleet" },
    },
  ],
};
