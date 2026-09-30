import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { createTestContext, type TestContext } from "./harness";

let ctx: TestContext;
beforeEach(async () => {
  ctx = await createTestContext();
});
afterEach(async () => {
  await ctx.close();
});

const preflight = (path: string) =>
  ctx.request(path, {
    method: "OPTIONS",
    headers: {
      origin: "https://localhost",
      "access-control-request-method": "POST",
      "access-control-request-headers": "content-type",
    },
  });

describe("CORS", () => {
  it("lets an app's WebView call the device endpoints", async () => {
    for (const path of [
      "/api/update",
      "/api/stats",
      "/api/native-updates/log",
      "/api/channel_self",
    ]) {
      const response = await preflight(path);
      expect(response.status, path).toBeLessThan(300);
      expect(response.headers.get("access-control-allow-origin"), path).toBe("*");
      expect(response.headers.get("access-control-allow-credentials"), path).toBeNull();
    }
    const check = await ctx.request("/api/update", {
      method: "POST",
      headers: { origin: "https://localhost" },
      json: { app_id: "com.none", device_id: "d", platform: "android" },
    });
    expect(check.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("never opens the management API to other origins", async () => {
    for (const path of ["/api/auth/login", "/api/apps", "/api/api-keys", "/api/channels/x/point"]) {
      const response = await preflight(path);
      expect(response.headers.get("access-control-allow-origin"), path).toBeNull();
    }
  });
});
