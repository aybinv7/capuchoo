import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import { appsRoutes } from "@/modules/apps/routes";
import { auditRoutes } from "@/modules/audit/routes";
import { authRoutes } from "@/modules/auth/routes";
import { buildsRoutes } from "@/modules/builds/routes";
import { canvasRoutes } from "@/modules/canvas/routes";
import { channelsRoutes } from "@/modules/channels/routes";
import { devicesRoutes } from "@/modules/devices/routes";
import { releasesRoutes } from "@/modules/releases/routes";
import { settingsRoutes } from "@/modules/settings/routes";
import { statisticsRoutes } from "@/modules/statistics/routes";
import type { ModuleRoutes } from "@/shared/router/module-routes";
import { RouteName } from "@/shared/router/route-names";

const MODULES: ModuleRoutes[] = [
  authRoutes,
  appsRoutes,
  canvasRoutes,
  channelsRoutes,
  releasesRoutes,
  buildsRoutes,
  devicesRoutes,
  statisticsRoutes,
  auditRoutes,
  settingsRoutes,
];

const collect = (scope: keyof ModuleRoutes): RouteRecordRaw[] =>
  MODULES.flatMap((module) => module[scope] ?? []);

const routes: RouteRecordRaw[] = [
  ...collect("public"),
  {
    path: "/",
    component: () => import("@/shared/layouts/AppShell.vue"),
    children: [
      { path: "", redirect: { name: RouteName.apps } },
      ...collect("workspace"),
      {
        path: "apps/:appId",
        component: () => import("@/shared/layouts/AppScope.vue"),
        children: [{ path: "", redirect: { name: RouteName.canvas } }, ...collect("app")],
      },
    ],
  },
  {
    path: "/:pathMatch(.*)*",
    name: RouteName.notFound,
    component: () => import("@/shared/pages/NotFoundPage.vue"),
    meta: { public: true, title: "Not found" },
  },
];

export function createAppRouter() {
  return createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
    scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 },
  });
}
