import type { Router } from "framework7/types";
import { lazyRoute } from "@/shared/utils/lazyRoute";

const profileRoutes: Router.RouteParameters[] = [
  { name: "profile", path: "/profile/", async: lazyRoute(() => import("../../views/ProfileView.vue")) },
];

export default profileRoutes;
