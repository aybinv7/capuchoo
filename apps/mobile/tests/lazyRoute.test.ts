import { expect, test, vi } from "vite-plus/test";
import { lazyRoute } from "../src/shared/utils/lazyRoute.js";

function callRoute(handler: ReturnType<typeof lazyRoute>) {
  const resolve = vi.fn();
  const reject = vi.fn();
  (handler as (ctx: unknown) => void)({ resolve, reject });
  return { resolve, reject };
}

test("resolves the route with the module's default export", async () => {
  const component = { name: "HomeView" };
  const { resolve, reject } = callRoute(lazyRoute(() => Promise.resolve({ default: component })));

  await vi.waitFor(() => expect(resolve).toHaveBeenCalledOnce());
  expect(resolve).toHaveBeenCalledWith({ component });
  expect(reject).not.toHaveBeenCalled();
});

test("rejects the route when the chunk fails to load, releasing the router", async () => {
  // Without this the router keeps allowPageChange === false forever and the view freezes.
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const { resolve, reject } = callRoute(
    lazyRoute(() => Promise.reject(new Error("chunk load failed"))),
  );

  await vi.waitFor(() => expect(reject).toHaveBeenCalledOnce());
  expect(resolve).not.toHaveBeenCalled();
  consoleError.mockRestore();
});
