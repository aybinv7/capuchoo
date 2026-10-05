import type { Router } from "framework7/types";
import { lazyRoute } from "@/shared/utils/lazyRoute";

const devicesRoutes: Router.RouteParameters[] = [
  {
    name: "devices",
    path: "/devices/",
    async: lazyRoute(() => import("../../views/DevicesView.vue")),
  },
  {
    name: "device",
    path: "/devices/:deviceId/",
    async: lazyRoute(() => import("../../views/DeviceView.vue")),
  },
];

export default devicesRoutes;
