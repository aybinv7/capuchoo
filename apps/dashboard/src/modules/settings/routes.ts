import type { ModuleRoutes } from "@/shared/router/module-routes";
import { RouteName } from "@/shared/router/route-names";

export const settingsRoutes: ModuleRoutes = {
  workspace: [
    { path: "settings", redirect: { name: RouteName.account } },
    {
      path: "settings/account",
      name: RouteName.account,
      component: () => import("./pages/AccountPage.vue"),
      meta: { title: "Profile", section: "Account" },
    },
    {
      path: "settings/api-keys",
      name: RouteName.apiKeys,
      component: () => import("./pages/ApiKeysPage.vue"),
      meta: { title: "API keys", section: "Account" },
    },
    {
      path: "settings/organization",
      name: RouteName.organization,
      component: () => import("./pages/OrganizationPage.vue"),
      meta: { title: "Organization", section: "Workspace" },
    },
    {
      path: "settings/github",
      name: RouteName.githubApp,
      component: () => import("./pages/GithubAppPage.vue"),
      meta: { title: "GitHub App", section: "Workspace" },
    },
    {
      path: "settings/demo",
      name: RouteName.demo,
      component: () => import("./pages/DemoPage.vue"),
      meta: { title: "Demo", section: "Workspace", instanceAdmin: true },
    },
  ],
  app: [
    {
      path: "settings",
      component: () => import("./pages/AppSettingsLayout.vue"),
      meta: { section: "App settings" },
      children: [
        { path: "", redirect: { name: RouteName.appGeneral } },
        {
          path: "general",
          name: RouteName.appGeneral,
          component: () => import("./pages/AppGeneralPage.vue"),
          meta: { title: "General" },
        },
        {
          path: "access",
          name: RouteName.appPermissions,
          component: () => import("./pages/AppPermissionsPage.vue"),
          meta: { title: "Access" },
        },
        {
          path: "signing",
          name: RouteName.appSigning,
          component: () => import("./pages/AppSigningPage.vue"),
          meta: { title: "Signing" },
        },
        {
          path: "ci",
          name: RouteName.appCi,
          component: () => import("./pages/AppCiPage.vue"),
          meta: { title: "CI" },
        },
        { path: "gitlab", redirect: { name: RouteName.appCi } },
        {
          path: "config",
          name: RouteName.appConfig,
          component: () => import("./pages/AppConfigPage.vue"),
          meta: { title: "Remote config" },
        },
      ],
    },
  ],
};
