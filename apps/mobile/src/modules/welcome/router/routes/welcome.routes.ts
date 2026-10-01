import type { Router } from "framework7/types";
import { lazyRoute } from "@/shared/utils/lazyRoute";

const welcomeRoutes: Router.RouteParameters[] = [
  {
    name: "welcome",
    path: "/welcome/",
    async: lazyRoute(() => import("../../views/WelcomeView.vue")),
  },
];

export default welcomeRoutes;
