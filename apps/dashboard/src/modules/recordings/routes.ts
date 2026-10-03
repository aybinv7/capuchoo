import type { ModuleRoutes } from "@/shared/router/module-routes";
import { RouteName } from "@/shared/router/route-names";

export const recordingsRoutes: ModuleRoutes = {
  app: [
    {
      path: "recordings",
      name: RouteName.recordings,
      component: () => import("./pages/RecordingsPage.vue"),
      meta: { title: "Recordings", section: "Fleet" },
    },
    {
      path: "recordings/rules",
      name: RouteName.recordingRules,
      component: () => import("./pages/RecordingRulesPage.vue"),
      meta: { title: "What devices record", section: "Recordings", parent: RouteName.recordings },
    },
    {
      path: "recordings/connect",
      name: RouteName.recordingSetup,
      component: () => import("./pages/RecordingSetupPage.vue"),
      meta: { title: "Connect an app", section: "Recordings", parent: RouteName.recordings },
    },
    {
      path: "recordings/:recordingId",
      name: RouteName.recording,
      component: () => import("./pages/RecordingPlayerPage.vue"),
      meta: { title: "Recording", section: "Recordings", parent: RouteName.recordings },
    },
  ],
};
