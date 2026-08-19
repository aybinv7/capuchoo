import type { Router } from "framework7/types";

const appsRoutes: Router.RouteParameters[] = [
  {
    name: "apps",
    path: "/apps",
    routes: [],

    async({ resolve }) {
      import("@/modules/apps/views/AppsList.vue").then((vc) => {
        resolve({ component: vc.default });
      });
    },
  },
  {
    name: "app-details",
    path: "/apps/:id",
    async({ resolve, to }) {
      import("@/modules/apps/views/AppDetails.vue").then((vc) => {
        resolve({
          component: vc.default,
          props: { id: to.params.id },
        });
      });
    },
  },
];

export default appsRoutes;
