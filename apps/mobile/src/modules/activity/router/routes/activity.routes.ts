import type { Router } from "framework7/types";
import { lazyRoute } from "@/shared/utils/lazyRoute";

const activityRoutes: Router.RouteParameters[] = [
  {
    name: "activity",
    path: "/activity/",
    async: lazyRoute(() => import("../../views/ActivityView.vue")),
  },
];

export default activityRoutes;
