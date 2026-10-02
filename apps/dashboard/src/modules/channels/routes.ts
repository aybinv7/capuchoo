import type { ModuleRoutes } from "@/shared/router/module-routes";
import { RouteName } from "@/shared/router/route-names";

export const channelsRoutes: ModuleRoutes = {
  app: [
    {
      path: "channels",
      name: RouteName.channels,
      component: () => import("./pages/ChannelsPage.vue"),
      meta: { title: "Channels", section: "Release" },
    },
    {
      path: "channels/:channelId",
      name: RouteName.channel,
      component: () => import("./pages/ChannelDetailPage.vue"),
      meta: { title: "Channel", section: "Channels", parent: RouteName.channels },
    },
  ],
};
