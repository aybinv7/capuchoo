import type { ModuleRoutes } from "@/shared/router/module-routes";
import { RouteName } from "@/shared/router/route-names";

export const auditRoutes: ModuleRoutes = {
  app: [
    {
      path: "audit",
      name: RouteName.audit,
      component: () => import("./pages/AuditPage.vue"),
      meta: { title: "Audit log", section: "Administration", minRole: "admin" },
    },
  ],
};
