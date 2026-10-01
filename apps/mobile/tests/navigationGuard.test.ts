import { expect, test } from "vite-plus/test";
import { installNavigationGuard } from "../src/shared/composables/useNavigationGuard.js";

function makeRouter() {
  const calls: string[] = [];
  const router = {
    allowPageChange: true,
    navigate(url: string) {
      calls.push(`navigate:${url}`);
    },
    back() {
      calls.push("back");
    },
  };
  return { router, calls };
}

test("drops a navigate issued while a transition is still in flight", () => {
  const { router, calls } = makeRouter();
  installNavigationGuard(router as never);

  router.allowPageChange = false;
  router.navigate("/home/feature/1/");

  expect(calls).toEqual([]);
});

test("drops a back issued while a transition is still in flight", () => {
  const { router, calls } = makeRouter();
  installNavigationGuard(router as never);

  router.allowPageChange = false;
  router.back();

  expect(calls).toEqual([]);
});

test("lets navigation through while the router is idle", () => {
  const { router, calls } = makeRouter();
  installNavigationGuard(router as never);

  router.navigate("/home/feature/1/");
  router.back();

  expect(calls).toEqual(["navigate:/home/feature/1/", "back"]);
});

test("still allows Framework7's own recursive calls after it locks the router", () => {
  // back() re-enters itself with { force: true }, and navigate() re-enters for named routes, both
  // after allowPageChange is already false. Dropping those would break normal navigation.
  const calls: string[] = [];
  const router = {
    allowPageChange: true,
    navigate(url: string) {
      calls.push(`navigate:${url}`);
      router.allowPageChange = false;
      if (url === "outer") router.navigate("inner");
    },
    back() {
      calls.push("back");
      router.allowPageChange = false;
      router.navigate("from-back");
    },
  };
  installNavigationGuard(router as never);

  router.navigate("outer");
  router.allowPageChange = true;
  router.back();

  expect(calls).toEqual(["navigate:outer", "navigate:inner", "back", "navigate:from-back"]);
});

test("installing twice does not wrap the router twice", () => {
  const { router, calls } = makeRouter();
  installNavigationGuard(router as never);
  installNavigationGuard(router as never);

  router.navigate("/demo/");

  expect(calls).toEqual(["navigate:/demo/"]);
});
