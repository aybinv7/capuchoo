import type { Router } from "framework7/types";
import activityRoutes from "@/modules/activity/router/routes/activity.routes";
import appsRoutes from "@/modules/apps/router/routes/apps.routes";
import authRoutes from "@/modules/auth/router/routes/auth.routes";
import profileRoutes from "@/modules/profile/router/routes/profile.routes";
import welcomeRoutes from "@/modules/welcome/router/routes/welcome.routes";
import globalRoutes from "./global/global.routes";

/**
 * Each module owns its routes; this only orders them. The catch-all is last because Framework7
 * takes the first match.
 */
const routes: Router.RouteParameters[] = [
  ...welcomeRoutes,
  ...authRoutes,
  ...appsRoutes,
  ...activityRoutes,
  ...profileRoutes,
  ...globalRoutes,
];

export default routes;
