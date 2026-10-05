import { afterEach, expect, test } from "vite-plus/test";
import { tabsFor } from "../src/app/tabs.js";
import { can } from "../src/shared/access/capabilities.js";
import { isPreviewing, setViewAs, viewedRole } from "../src/shared/access/viewAs.js";

const admin = { role: "admin" as const, prod_role: "admin" as const };
const tester = { role: "tester" as const, prod_role: "admin" as const };

afterEach(() => setViewAs(null));

test("a tester gets builds and devices only; a developer gets the release desk too", () => {
  expect(tabsFor(tester).map((tab) => tab.id)).toEqual(["builds", "devices"]);
  expect(tabsFor({ role: "viewer", prod_role: "admin" }).map((tab) => tab.id)).toEqual([
    "builds",
    "devices",
  ]);
  expect(tabsFor(admin).map((tab) => tab.id)).toEqual(["home", "channels", "builds", "devices"]);
});

test("a tester reads and installs on their own phone, and acts on nothing else", () => {
  expect(can.install(tester)).toBe(true);
  expect(can.deliver(tester, "dev")).toBe(false);
  expect(can.assignDevice(tester, "dev")).toBe(false);
  expect(can.assignDevice(tester, undefined)).toBe(false);
  expect(can.removeDevice(tester)).toBe(false);
  expect(can.manageAccess(tester)).toBe(false);
  expect(can.install({ role: "viewer", prod_role: "admin" }), "a viewer only reads").toBe(false);
});

test("viewing as a tester narrows every check an admin passes", () => {
  setViewAs("tester");
  expect(viewedRole("admin")).toBe("tester");
  expect(isPreviewing("admin")).toBe(true);
  expect(can.manageAccess(admin)).toBe(false);
  expect(can.deliver(admin, "prod")).toBe(false);
  expect(can.install(admin)).toBe(true);
  expect(tabsFor(admin).map((tab) => tab.id)).toEqual(["builds", "devices"]);
});

test("a preview never raises a role", () => {
  setViewAs("admin");
  expect(viewedRole("tester")).toBe("tester");
  expect(isPreviewing("tester")).toBe(false);
  expect(can.manageAccess(tester)).toBe(false);
});
