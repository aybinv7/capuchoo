import type { ModuleRoutes } from "@/shared/router/module-routes";
import { RouteName } from "@/shared/router/route-names";

export const canvasRoutes: ModuleRoutes = {
  app: [
    {
      path: "canvas",
      name: RouteName.canvas,
      component: () => import("./pages/CanvasPage.vue"),
      meta: { title: "Canvas", section: "Release" },
    },
  ],
};
