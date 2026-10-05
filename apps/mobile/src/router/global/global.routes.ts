import type { Router } from "framework7/types";
import { lazyRoute } from "@/shared/utils/lazyRoute";

const globalRoutes: Router.RouteParameters[] = [
  {
    name: "loading",
    path: "/loading/",
    async: lazyRoute(() => import("@/shared/components/app/LoadingPage.vue")),
  },
  {
    name: "not-found",
    path: "(.*)",
    async: lazyRoute(() => import("@/shared/components/error/404.vue")),
  },
];

export default globalRoutes;
