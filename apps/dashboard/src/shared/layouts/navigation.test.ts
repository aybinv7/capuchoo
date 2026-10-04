import { describe, expect, it } from "vite-plus/test";
import { RouteName } from "../router/route-names";
import { recordingsRoutes } from "@/modules/recordings/routes";
import { APP_NAVIGATION, WORKSPACE_NAVIGATION, navItemVisible } from "./navigation";

const items = WORKSPACE_NAVIGATION.flatMap((group) => group.items);
const demo = items.find((item) => item.name === RouteName.demo)!;

describe("navItemVisible", () => {
  it("shows the demo page to instance administrators only", () => {
    expect(navItemVisible(demo, null)).toBe(false);
    expect(navItemVisible(demo, "admin")).toBe(false);
    expect(navItemVisible(demo, null, true)).toBe(true);
  });

  it("puts the demo page right after the GitHub App", () => {
    const names = items.map((item) => item.name);
    expect(names.indexOf(RouteName.demo)).toBe(names.indexOf(RouteName.githubApp) + 1);
  });

  it("still gates app pages by role", () => {
    expect(
      navItemVisible({ ...demo, instanceAdmin: false, minRole: "admin" }, "viewer", true),
    ).toBe(false);
  });
});

describe("app navigation", () => {
  const appItems = APP_NAVIGATION.flatMap((group) => group.items);
  const highlighted = new Set<string>(
    appItems.flatMap((item) => [
      item.name,
      ...(item.also ?? []),
      ...(item.children ?? []).map((child) => child.name),
    ]),
  );

  it("lights an item on every session replay page", () => {
    for (const route of recordingsRoutes.app ?? []) {
      expect(highlighted.has(String(route.name)), String(route.name)).toBe(true);
    }
  });

  it("opens on the overview, ahead of the release pages", () => {
    expect(appItems[0]!.name).toBe(RouteName.overview);
  });
});
