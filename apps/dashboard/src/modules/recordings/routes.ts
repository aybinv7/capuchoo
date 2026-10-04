import type { ModuleRoutes } from "@/shared/router/module-routes";
import { RouteName } from "@/shared/router/route-names";

export const recordingsRoutes: ModuleRoutes = {
  app: [
    {
      path: "recordings",
      name: RouteName.recordings,
      component: () => import("./pages/RecordingsPage.vue"),
      meta: { title: "Sessions", section: "Session replay" },
    },
    {
      path: "recordings/rules",
      name: RouteName.recordingRules,
      component: () => import("./pages/RecordingRulesPage.vue"),
      meta: {
        title: "What devices record",
        section: "Session replay",
        parent: RouteName.recordings,
      },
    },
    {
      path: "recordings/errors",
      name: RouteName.recordingIssues,
      component: () => import("./pages/RecordingIssuesPage.vue"),
      meta: { title: "Errors", section: "Session replay", parent: RouteName.recordings },
    },
    {
      path: "recordings/connect",
      name: RouteName.recordingSetup,
      component: () => import("./pages/RecordingSetupPage.vue"),
      meta: { title: "Connect an app", section: "Session replay", parent: RouteName.recordings },
    },
    {
      path: "recordings/assist/:deviceId",
      name: RouteName.recordingAssist,
      component: () => import("./pages/AssistPage.vue"),
      meta: { title: "Assist", section: "Session replay", parent: RouteName.recordings },
    },
    {
      path: "recordings/:recordingId",
      name: RouteName.recording,
      component: () => import("./pages/RecordingPlayerPage.vue"),
      meta: { title: "Recording", section: "Session replay", parent: RouteName.recordings },
    },
  ],
};
