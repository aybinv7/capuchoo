import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  store: new Map<string, string>(),
  requestJson: vi.fn<(url: string, options: unknown) => Promise<unknown>>(),
}));

vi.mock("./device.js", () => ({
  getDeviceId: async () => "device-1",
  getPlatform: () => "android",
  getVersionCode: async () => 70,
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

const channel = await import("./channel.service.js");
const { configureUpdater, resetUpdaterConfig } = await import("./config.js");
const { HttpError } = await import("./http.js");

beforeEach(() => {
  mocks.store.clear();
  mocks.requestJson.mockReset();
  channel.__resetChannelCache();
  resetUpdaterConfig();
  configureUpdater({ apiUrl: "https://api.test", appId: "com.efficy.app", channel: "prod" });
});

describe("the runtime channel", () => {
  it("follows the build's default until one is chosen", async () => {
    expect(await channel.getChannelOverride()).toBeNull();
    expect(await channel.getChannel()).toBe("prod");
  });

  it("tells the server, then remembers the choice", async () => {
    mocks.requestJson.mockResolvedValue({ channel: "beta", status: "override", allowSet: true });

    await channel.setChannel(" beta ");

    expect(mocks.requestJson).toHaveBeenCalledWith("https://api.test/api/channel_self", {
      body: {
        app_id: "com.efficy.app",
        device_id: "device-1",
        platform: "android",
        version_code: "70",
        defaultChannel: "prod",
        channel: "beta",
      },
      timeoutMs: 15_000,
    });
    expect(mocks.store.get("capuchoo.channel")).toBe("beta");
    expect(await channel.getChannel()).toBe("beta");
  });

  it("survives a restart through storage", async () => {
    mocks.store.set("capuchoo.channel", "beta");

    expect(await channel.getChannel()).toBe("beta");
  });

  it.each([
    [
      "an HTTP refusal",
      () => Promise.reject(new HttpError("u", 403, "", "Self-assignment disabled")),
    ],
    ["allowSet: false", () => Promise.resolve({ allowSet: false })],
    ["an error body", () => Promise.resolve({ error: "Unknown channel" })],
  ])("remembers nothing after %s", async (_label, respond) => {
    mocks.requestJson.mockImplementation(respond);

    await expect(channel.setChannel("beta")).rejects.toBeInstanceOf(channel.ChannelChangeError);
    expect(mocks.store.has("capuchoo.channel")).toBe(false);
    expect(await channel.getChannel()).toBe("prod");
  });

  it("names the server's reason for a refusal", async () => {
    mocks.requestJson.mockRejectedValue(new HttpError("u", 403, "", "Self-assignment disabled"));

    await expect(channel.setChannel("beta")).rejects.toThrow("Self-assignment disabled");
  });

  it("refuses an empty name without asking the server", async () => {
    await expect(channel.setChannel("  ")).rejects.toThrow(/required/);
    expect(mocks.requestJson).not.toHaveBeenCalled();
  });

  it("clears the choice even when the server cannot be told", async () => {
    mocks.store.set("capuchoo.channel", "beta");
    mocks.requestJson.mockRejectedValue(new Error("offline"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await channel.clearChannel();

    expect(await channel.getChannel()).toBe("prod");
    expect(mocks.requestJson.mock.calls[0]![0]).toBe(
      "https://api.test/api/channel_self?app_id=com.efficy.app&device_id=device-1&platform=android",
    );
    expect(mocks.requestJson.mock.calls[0]![1]).toMatchObject({ method: "DELETE" });
    warn.mockRestore();
  });
});
