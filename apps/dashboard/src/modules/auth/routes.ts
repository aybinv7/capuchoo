import type { ModuleRoutes } from "@/shared/router/module-routes";
import { RouteName } from "@/shared/router/route-names";

export const authRoutes: ModuleRoutes = {
  public: [
    {
      path: "/login",
      name: RouteName.login,
      component: () => import("./pages/LoginPage.vue"),
      meta: { public: true, title: "Sign in" },
    },
    {
      path: "/invite/:token",
      name: RouteName.invite,
      component: () => import("./pages/InvitePage.vue"),
      meta: { public: true, title: "Invitation" },
    },
  ],
};
