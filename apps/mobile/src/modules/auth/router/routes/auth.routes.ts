import type { Router } from "framework7/types";
import { lazyRoute } from "@/shared/utils/lazyRoute";

const authRoutes: Router.RouteParameters[] = [
  { name: "sign-in", path: "/sign-in/", async: lazyRoute(() => import("../../views/SignInView.vue")) },
];

export default authRoutes;
