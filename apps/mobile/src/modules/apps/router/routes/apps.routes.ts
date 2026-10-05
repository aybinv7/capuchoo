import type { Router } from "framework7/types";
import { lazyRoute } from "@/shared/utils/lazyRoute";

const appsRoutes: Router.RouteParameters[] = [
  {
    name: "choose-app",
    path: "/choose-app/",
    async: lazyRoute(() => import("../../views/ChooseAppView.vue")),
  },
];

export default appsRoutes;
