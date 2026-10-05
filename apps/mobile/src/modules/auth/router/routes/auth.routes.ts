import type { Router } from "framework7/types";
import { lazyRoute } from "@/shared/utils/lazyRoute";

const authRoutes: Router.RouteParameters[] = [
  {
    name: "sign-in",
    path: "/sign-in/",
    async: lazyRoute(() => import("../../views/ServerStepView.vue")),
  },
  {
    name: "sign-in-account",
    path: "/sign-in/account/",
    async: lazyRoute(() => import("../../views/AccountStepView.vue")),
  },
];

export default authRoutes;
