import type { Router } from "framework7/types";
import { lazyRoute } from "@/shared/utils/lazyRoute";

const profileRoutes: Router.RouteParameters[] = [
  {
    name: "profile",
    path: "/profile/",
    async: lazyRoute(() => import("../../views/ProfileView.vue")),
  },
  {
    name: "appearance",
    path: "/profile/appearance/",
    async: lazyRoute(() => import("../../views/AppearanceView.vue")),
  },
  {
    name: "colors",
    path: "/profile/appearance/colors/",
    async: lazyRoute(() => import("../../views/ColorThemesView.vue")),
  },
  {
    name: "notification-settings",
    path: "/profile/notifications/",
    async: lazyRoute(() => import("../../views/NotificationSettingsView.vue")),
  },
];

export default profileRoutes;
