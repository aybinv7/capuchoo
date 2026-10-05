import type { Router } from "framework7/types";
import { lazyRoute } from "@/shared/utils/lazyRoute";

const buildsRoutes: Router.RouteParameters[] = [
  {
    name: "builds",
    path: "/builds/",
    async: lazyRoute(() => import("../../views/BuildsView.vue")),
  },
  {
    name: "build",
    path: "/builds/:nativeId/",
    async: lazyRoute(() => import("../../views/BuildView.vue")),
  },
];

export default buildsRoutes;
