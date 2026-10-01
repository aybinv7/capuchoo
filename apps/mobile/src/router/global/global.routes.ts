import type { Router } from "framework7/types";
import { lazyRoute } from "@/shared/utils/lazyRoute";

const globalRoutes: Router.RouteParameters[] = [
  {
    name: "not-found",
    path: "(.*)",
    async: lazyRoute(() => import("@/shared/components/error/404.vue")),
  },
];

export default globalRoutes;
