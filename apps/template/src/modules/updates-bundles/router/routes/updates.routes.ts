import type { Router } from "framework7/types";

const routes: Router.RouteParameters[] = [
  {
    name: "updates-bundles",
    path: "/updates-bundles",
    async({ resolve }) {
      import("@/modules/updates-bundles/views/UpdatesList.vue").then((vc) => {
        resolve({ component: vc.default });
      });
    },
  },
  {
    name: "update-details",
    path: "/updates-bundles/:id",
    async({ resolve }) {
      import("@/modules/updates-bundles/views/UpdateDetails.vue").then((vc) => {
        resolve({ component: vc.default });
      });
    },
  },
  {
    name: "create-update",
    path: "/updates-bundles/create",
    async({ resolve }) {
      import("@/modules/updates-bundles/views/CreateUpdateView.vue").then((vc) => {
        resolve({ component: vc.default });
      });
    },
  },
];

export default routes;
