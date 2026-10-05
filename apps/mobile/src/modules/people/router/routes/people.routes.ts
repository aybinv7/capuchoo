import type { Router } from "framework7/types";
import { lazyRoute } from "@/shared/utils/lazyRoute";

const peopleRoutes: Router.RouteParameters[] = [
  {
    name: "people",
    path: "/people/",
    async: lazyRoute(() => import("../../views/PeopleView.vue")),
  },
];

export default peopleRoutes;
