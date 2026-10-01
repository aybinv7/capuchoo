import type { Router } from "framework7/types";

type RouteComponentModule = { default: unknown };

/**
 * Framework7 sets `allowPageChange = false` before calling a route's async hook and only restores
 * it from `resolve` or `reject`. A hook that settles neither - a chunk that fails to download, or a
 * module that throws while evaluating - leaves that view's router locked for the rest of the
 * session, so every later navigation and back press is silently ignored. Routing the import
 * through here guarantees the router is always released.
 */
export function lazyRoute(
  load: () => Promise<RouteComponentModule>,
): Router.RouteParameters["async"] {
  return function routeAsync({ resolve, reject }) {
    load()
      .then((module) => {
        resolve({ component: module.default });
      })
      .catch((error: unknown) => {
        console.error("[router] Unable to load route component", error);
        reject();
      });
  };
}
