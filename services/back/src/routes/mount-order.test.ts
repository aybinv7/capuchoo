import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";

/**
 * `adminRoutes` is mounted at "/" and applies `authenticate` at router level, so
 * every route registered after it is reachable only by an authenticated request.
 * That silently made /api/auth/login and /api/auth/register answer 401 to
 * everyone - unreachable since they were written.
 *
 * Asserted against the source because the thing being tested is the order of
 * `router.use` calls. Booting the app would need Supabase credentials and would
 * not fail any more clearly.
 */
const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

const mounts = [...source.matchAll(/router\.use\(\s*"([^"]+)"/g)].map((match, index) => ({
  path: match[1]!,
  order: index,
}));

describe("route mount order", () => {
  it("mounts something", () => {
    expect(mounts.length).toBeGreaterThan(5);
  });

  it("registers every prefixed router before the catch-all ones", () => {
    const lastPrefixed = Math.max(...mounts.filter((m) => m.path !== "/").map((m) => m.order));
    const firstCatchAll = Math.min(...mounts.filter((m) => m.path === "/").map((m) => m.order));

    expect(lastPrefixed).toBeLessThan(firstCatchAll);
  });

  it.each(["/auth", "/api-keys"])("keeps %s reachable without a credential", (prefix) => {
    const target = mounts.find((m) => m.path === prefix);
    const firstCatchAll = Math.min(...mounts.filter((m) => m.path === "/").map((m) => m.order));

    expect(target, `${prefix} is not mounted`).toBeDefined();
    expect(target!.order).toBeLessThan(firstCatchAll);
  });
});
