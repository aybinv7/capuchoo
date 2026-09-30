import type { RouteRecordRaw } from "vue-router";

/**
 * What a module contributes to the router. `public` routes need no session, `workspace` routes sit
 * in the shell outside any app, `app` routes are children of `/apps/:appId` and get the app's live
 * stream. Paths of `app` routes are relative to that prefix.
 */
export interface ModuleRoutes {
  public?: RouteRecordRaw[];
  workspace?: RouteRecordRaw[];
  app?: RouteRecordRaw[];
}
