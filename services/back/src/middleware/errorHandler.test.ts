import { describe, expect, it } from "vite-plus/test";
import { errorHandler, notFoundHandler } from "./errorHandler";

/**
 * Express selects error middleware by arity. At three parameters `errorHandler`
 * was registered but never invoked, so `next(error)` produced Express's default
 * HTML page - `/api/auth/login` answered a bad password with
 * `<pre>Unauthorized</pre>` instead of JSON.
 */
describe("errorHandler", () => {
  it("takes the four parameters Express requires", () => {
    expect(errorHandler.length).toBe(4);
  });

  it("leaves notFoundHandler as ordinary middleware", () => {
    expect(notFoundHandler.length).toBe(3);
  });
});
