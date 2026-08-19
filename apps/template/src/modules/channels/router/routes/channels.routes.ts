import type { Router } from "framework7/types";

const routes: Router.RouteParameters[] = [
  {
    path: "/channels",
    async({ resolve }) {
      import("@/modules/channels/views/ChannelsList.vue").then((vc) => {
        resolve({ component: vc.default });
      });
    },
  },
  {
    path: "/channels/:id",
    async({ resolve }) {
      import("@/modules/channels/views/ChannelDetails.vue").then((vc) => {
        resolve({ component: vc.default });
      });
    },
  },
];

export default routes;
