import type { Router } from "framework7/types";

const routes: Router.RouteParameters[] = [
  {
    name: "login",
    path: "/auth/login",
    routes: [],

    // beforeEnter: (context) => useAuthGuard(context),

    async({ resolve }) {
      import("@/modules/auth/views/Login.vue").then((vc) => {
        resolve({ component: vc.default });
      });
    },
  },
  {
    name: "register",
    path: "/auth/register",
    routes: [],

    // beforeEnter: (context) => useAuthGuard(context),

    async({ resolve }) {
      import("@/modules/auth/views/Register.vue").then((vc) => {
        resolve({ component: vc.default });
      });
    },
  },
];

export default routes;
