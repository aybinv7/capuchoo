import type { Router } from "framework7/types";

const routes: Router.RouteParameters[] = [
  {
    path: "/settings",
    async({ resolve }) {
      import("@/modules/settings/views/SettingsView.vue").then((vc) => {
        resolve({ component: vc.default });
      });
    },
  },
  {
    path: "/settings/account",
    async({ resolve }) {
      import("@/modules/settings/views/SettingsAccount.vue").then((vc) => {
        resolve({ component: vc.default });
      });
    },
  },
  {
    path: "/settings/api-keys",
    async({ resolve }) {
      import("@/modules/settings/views/SettingsApiKeys.vue").then((vc) => {
        resolve({ component: vc.default });
      });
    },
  },
  {
    path: "/settings/app",
    async({ resolve }) {
      import("@/modules/settings/views/SettingsApp.vue").then((vc) => {
        resolve({ component: vc.default });
      });
    },
  },
  {
    path: "/settings/members",
    async({ resolve }) {
      import("@/modules/settings/views/SettingsMembers.vue").then((vc) => {
        resolve({ component: vc.default });
      });
    },
  },
];

export default routes;
