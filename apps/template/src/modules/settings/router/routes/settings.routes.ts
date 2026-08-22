import type { Router } from "framework7/types";

const routes: Router.RouteParameters[] = [
  {
    path: "/settings",
    async({ resolve }) {
      void import("@/modules/settings/views/SettingsView.vue").then((vc) => {
        resolve({ component: vc.default });
      });
    },
  },
  {
    path: "/settings/account",
    async({ resolve }) {
      void import("@/modules/settings/views/SettingsAccount.vue").then((vc) => {
        resolve({ component: vc.default });
      });
    },
  },
  {
    path: "/settings/api-keys",
    async({ resolve }) {
      void import("@/modules/settings/views/SettingsApiKeys.vue").then((vc) => {
        resolve({ component: vc.default });
      });
    },
  },
  {
    path: "/settings/app",
    async({ resolve }) {
      void import("@/modules/settings/views/SettingsApp.vue").then((vc) => {
        resolve({ component: vc.default });
      });
    },
  },
  {
    path: "/settings/members",
    async({ resolve }) {
      void import("@/modules/settings/views/SettingsMembers.vue").then((vc) => {
        resolve({ component: vc.default });
      });
    },
  },
];

export default routes;
