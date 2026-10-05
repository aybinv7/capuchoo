import type { Router } from "framework7/types";
import { lazyRoute } from "@/shared/utils/lazyRoute";

const channelsRoutes: Router.RouteParameters[] = [
  {
    name: "channels",
    path: "/channels/",
    async: lazyRoute(() => import("../../views/ChannelsView.vue")),
  },
  {
    name: "channel",
    path: "/channels/:channelId/",
    async: lazyRoute(() => import("../../views/ChannelView.vue")),
  },
];

export default channelsRoutes;
