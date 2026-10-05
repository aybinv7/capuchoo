import type { Router } from "framework7/types";
import { lazyRoute } from "@/shared/utils/lazyRoute";

const homeRoutes: Router.RouteParameters[] = [
  { name: "home", path: "/home/", async: lazyRoute(() => import("../../views/HomeView.vue")) },
];

export default homeRoutes;
