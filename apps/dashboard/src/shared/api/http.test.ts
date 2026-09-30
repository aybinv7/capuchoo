import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { ApiError } from "./errors";
import { buildUrl, onUnauthorized, request } from "./http";

function respond(status: number, body: unknown, headers: Record<string, string> = {}) {
  return vi.fn<() => Promise<Response>>(
    async () =>
      new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json", ...headers },
      }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  onUnauthorized(() => undefined);
});

describe("buildUrl", () => {
  it("prefixes /api and skips empty query values", () => {
    expect(
      buildUrl("/apps/1/devices", { limit: 50, offset: 0, search: "", channel_id: null }),
    ).toBe("/api/apps/1/devices?limit=50&offset=0");
    expect(buildUrl("auth/me")).toBe("/api/auth/me");
  });
});

describe("request", () => {
  it("sends JSON with the same-origin cookie and returns the body", async () => {
    const fetchMock = respond(200, { id: "c1" });
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      request("/channels/c1/point", { method: "POST", body: { bundle_id: "b1" } }),
    ).resolves.toEqual({
      id: "c1",
    });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.credentials).toBe("same-origin");
    expect(init.body).toBe('{"bundle_id":"b1"}');
    expect((init.headers as Record<string, string>)["content-type"]).toBe("application/json");
  });

  it("returns undefined for 204", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 204 })),
    );
    await expect(request("/channels/c1", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("maps a refusal to an ApiError with the server's reason", async () => {
    vi.stubGlobal(
      "fetch",
      respond(409, { error: "Still served by prod.", reason: "still_served" }),
    );
    const error = await request("/bundles/b1", { method: "DELETE" }).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).reason).toBe("still_served");
  });

  it("tells the unauthorized listener about a 401", async () => {
    const listener = vi.fn<() => void>();
    onUnauthorized(listener);
    vi.stubGlobal(
      "fetch",
      respond(401, { error: "Authentication required", reason: "unauthorized" }),
    );
    await expect(request("/auth/me")).rejects.toBeInstanceOf(ApiError);
    expect(listener).toHaveBeenCalledOnce();
  });

  it("turns a network failure into a network ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))),
    );
    const error = (await request("/auth/me").catch((caught: unknown) => caught)) as ApiError;
    expect(error.reason).toBe("network");
    expect(error.status).toBe(0);
  });
});
