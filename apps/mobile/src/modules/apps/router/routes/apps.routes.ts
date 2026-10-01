import type { Router } from "framework7/types";
import { lazyRoute } from "@/shared/utils/lazyRoute";

const appsRoutes: Router.RouteParameters[] = [
  { name: "apps", path: "/apps/", async: lazyRoute(() => import("../../views/AppsView.vue")) },
  { name: "app", path: "/apps/:appId/", async: lazyRoute(() => import("../../views/AppDetailView.vue")) },
  {
    name: "build",
    path: "/apps/:appId/builds/:nativeId/",
    async: lazyRoute(() => import("../../views/BuildView.vue")),
  },
];

export default appsRoutes;
