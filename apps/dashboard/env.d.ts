/// <reference types="vite/client" />

import "vue-router";

declare module "vue-router" {
  interface RouteMeta {
    /** Reachable without a session. */
    public?: boolean;
    /** Only an instance administrator may open it; others are sent back to their apps. */
    instanceAdmin?: boolean;
    /** Minimum app role; the route is refused below it. */
    minRole?: import("@capuchoo/core").AppRole;
    /** Page title shown in the tab and the breadcrumb. */
    title?: string;
    /** Sidebar group this page belongs to. */
    section?: string;
  }
}
