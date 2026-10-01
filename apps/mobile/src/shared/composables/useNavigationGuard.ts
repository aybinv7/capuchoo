import { f7 } from "framework7-vue";

interface GuardableRouter {
  allowPageChange: boolean;
  navigate: (...args: never[]) => unknown;
  back: (...args: never[]) => unknown;
  __navigationGuarded?: boolean;
}

/**
 * Framework7 only enforces `allowPageChange` for synchronous routes. Routes here are async, and
 * `asyncResolve` calls the internal `load()` with `ignorePageChange: true`, so a navigate issued
 * while a transition is still animating runs a forward on top of an in-flight backward. That
 * destroys the previous page element and leaves the router holding two copies of the same page;
 * from there `loadBack` takes its same-url early return and back() can never move again, which
 * reads to the user as a frozen screen.
 *
 * Dropping the losing call is a single boolean read - no queueing, no deferral - so the navigation
 * that does win runs at exactly the same speed as before.
 */
export function installNavigationGuard(router: GuardableRouter): void {
  if (router.__navigationGuarded) return;
  router.__navigationGuarded = true;

  let depth = 0;

  const guard = (method: (...args: never[]) => unknown) => {
    return (...args: never[]) => {
      if (depth === 0 && !router.allowPageChange) return router;
      depth += 1;
      try {
        return method(...args);
      } finally {
        depth -= 1;
      }
    };
  };

  router.navigate = guard(router.navigate.bind(router));
  router.back = guard(router.back.bind(router));
}

export function useNavigationGuard(): void {
  const views = f7.views as unknown as Array<{ router?: GuardableRouter }>;
  for (const view of views ?? []) {
    if (view?.router) installNavigationGuard(view.router);
  }
}
