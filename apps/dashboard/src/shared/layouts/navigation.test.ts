import { describe, expect, it } from "vite-plus/test";
import { RouteName } from "../router/route-names";
import { WORKSPACE_NAVIGATION, navItemVisible } from "./navigation";

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
