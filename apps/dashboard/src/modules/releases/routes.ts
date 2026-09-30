import type { ModuleRoutes } from "@/shared/router/module-routes";
import { RouteName } from "@/shared/router/route-names";

export const releasesRoutes: ModuleRoutes = {
  app: [
    {
      path: "releases",
      name: RouteName.releases,
      component: () => import("./pages/ReleasesPage.vue"),
      meta: { title: "Releases", section: "Release" },
    },
  ],
};
