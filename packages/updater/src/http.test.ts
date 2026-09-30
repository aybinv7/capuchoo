import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const native = vi.hoisted(() => ({ isNative: true, request: vi.fn() }));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => native.isNative,
    isPluginAvailable: (name: string) => name === "CapacitorHttp" && native.isNative,
  },
  CapacitorHttp: { request: native.request },
}));

const { HttpError, NetworkError, requestJson } = await import("./http.js");

describe("requestJson on a device", () => {
  beforeEach(() => {
    native.isNative = true;
    native.request.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("fetch must not be used"))),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("goes through native HTTP and parses the answer", async () => {
    native.request.mockResolvedValue({ status: 200, data: { version: "1.2.0" }, headers: {} });
    await expect(
      requestJson("https://u.test/api/update", { body: { a: 1 }, timeoutMs: 1000 }),
    ).resolves.toEqual({
      version: "1.2.0",
    });
    expect(native.request).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://u.test/api/update", method: "POST", data: { a: 1 } }),
    );
  });

  it("parses a JSON string answer", async () => {
    native.request.mockResolvedValue({ status: 200, data: '{"ok":true}', headers: {} });
    await expect(requestJson("https://u.test/x", { timeoutMs: 1000 })).resolves.toEqual({
      ok: true,
    });
  });

  it("turns a refusal into HttpError with the server's message", async () => {
    native.request.mockResolvedValue({ status: 403, data: { error: "not allowed" }, headers: {} });
    const error = await requestJson("https://u.test/x", { timeoutMs: 1000 }).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(HttpError);
    expect((error as InstanceType<typeof HttpError>).serverMessage).toBe("not allowed");
  });

  it("turns a transport failure into NetworkError", async () => {
    native.request.mockRejectedValue(new Error("UnknownHostException"));
    await expect(requestJson("https://u.test/x", { timeoutMs: 1000 })).rejects.toBeInstanceOf(
      NetworkError,
    );
  });

  it("times out even when the native call never settles", async () => {
    native.request.mockReturnValue(new Promise(() => {}));
    const error = await requestJson("https://u.test/x", { timeoutMs: 20 }).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(NetworkError);
    expect((error as InstanceType<typeof NetworkError>).timedOut).toBe(true);
  });
});

describe("requestJson in a browser", () => {
  beforeEach(() => {
    native.isNative = false;
  });
  afterEach(() => vi.unstubAllGlobals());

  it("uses fetch", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response('{"ok":1}', { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);
    await expect(requestJson("https://u.test/x", { timeoutMs: 1000 })).resolves.toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
