import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  store: new Map<string, string>(),
  requestJson: vi.fn<(url: string, options: unknown) => Promise<unknown>>(),
}));

vi.mock("./device.js", () => ({
  getDeviceId: async () => "device-1",
  getPlatform: () => "android",
}));

vi.mock("./kv-store.js", () => ({
  readValue: async (key: string) => mocks.store.get(key) ?? null,
  writeValue: async (key: string, value: string) => void mocks.store.set(key, value),
  removeValue: async (key: string) => void mocks.store.delete(key),
}));

vi.mock("./http.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./http.js")>()),
  requestJson: mocks.requestJson,
}));

const attributes = await import("./attributes.service.js");
const { configureUpdater, resetUpdaterConfig } = await import("./config.js");
const { HttpError, NetworkError } = await import("./http.js");

beforeEach(() => {
  mocks.store.clear();
  mocks.requestJson.mockReset();
  mocks.requestJson.mockResolvedValue({ status: "ok" });
  attributes.__resetAttributesCache();
  resetUpdaterConfig();
  configureUpdater({ apiUrl: "https://api.test", appId: "com.efficy.app", channel: "prod" });
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("device attributes", () => {
  it("are null until the app sets some", async () => {
    expect(await attributes.getDeviceAttributes()).toBeNull();
  });

  it("merge a patch, remember it and tell the server", async () => {
    await attributes.setDeviceAttributes({ rep: "R-1042", route: "Oran West" });
    const next = await attributes.setDeviceAttributes({ route: null, store: 12, bad: undefined as never });
    await flush();

    expect(next).toEqual({ rep: "R-1042", store: 12 });
    expect(JSON.parse(mocks.store.get("capuchoo.attributes")!)).toEqual(next);
    expect(mocks.requestJson).toHaveBeenLastCalledWith("https://api.test/api/device_attributes", {
      body: {
        app_id: "com.efficy.app",
        device_id: "device-1",
        platform: "android",
        attributes: { rep: "R-1042", store: 12 },
      },
      timeoutMs: 15_000,
    });
  });

  it("apply concurrent patches in order", async () => {
    await Promise.all([
      attributes.setDeviceAttributes({ a: "1" }),
      attributes.setDeviceAttributes({ b: "2" }),
      attributes.setDeviceAttributes({ a: null }),
    ]);
    expect(await attributes.getDeviceAttributes()).toEqual({ b: "2" });
  });

  it("are kept when the server is unreachable or has not seen the device", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.requestJson.mockRejectedValueOnce(new NetworkError("https://api.test", false, null));
    await attributes.setDeviceAttributes({ rep: "R-1" });
    mocks.requestJson.mockRejectedValueOnce(
      new HttpError("https://api.test", 404, "Not Found", "Device not seen yet"),
    );
    await attributes.setDeviceAttributes({ route: "North" });
    await flush();

    expect(await attributes.getDeviceAttributes()).toEqual({ rep: "R-1", route: "North" });
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("clear to an empty set, which is still sent", async () => {
    await attributes.setDeviceAttributes({ rep: "R-1" });
    await attributes.clearDeviceAttributes();
    await flush();

    expect(await attributes.getDeviceAttributes()).toEqual({});
    attributes.__resetAttributesCache();
    expect(await attributes.getDeviceAttributes()).toEqual({});
    expect(mocks.requestJson).toHaveBeenLastCalledWith(
      "https://api.test/api/device_attributes",
      expect.objectContaining({ body: expect.objectContaining({ attributes: {} }) }),
    );
  });

  it("ignore a corrupt stored value", async () => {
    mocks.store.set("capuchoo.attributes", "{not json");
    expect(await attributes.getDeviceAttributes()).toBeNull();
  });
});
