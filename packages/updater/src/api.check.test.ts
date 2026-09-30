import { UpdateMessage, type ResolvedUpdate } from "@capuchoo/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({ channel: "prod" }));

vi.mock("./device.js", () => ({
  getBuiltinVersion: async () => "1.5.0",
  getBundleVersion: async () => "builtin",
  getDeviceId: async () => "device-1",
  getLocationFacts: async () => ({}),
  getOsFacts: async () => ({}),
  getPlatform: () => "android",
  getPluginVersion: async () => "8.51.13",
  getVersionCode: async () => 70,
  isNative: () => true,
}));

vi.mock("./channel.service.js", () => ({ getChannel: async () => mocks.channel }));

const { UpdateCheckBlockedError, checkForUpdate, reportUpdateEvent } =
  await import("./api.service.js");
const { configureUpdater, resetUpdaterConfig } = await import("./config.js");
const { HttpError, NetworkError } = await import("./http.js");

const fetchMock = vi.fn<typeof fetch>();

function answer(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const bundle = { version_name: "1.6.0", version: "1.6.0", url: "https://cdn.test/b.zip" };

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  resetUpdaterConfig();
  configureUpdater({
    apiUrl: "https://api.test",
    appId: "com.efficy.app",
    retryBaseDelayMs: 1_000,
  });
  mocks.channel = "prod";
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("checkForUpdate on a flaky network", () => {
  it("retries an unreachable server with backoff, then succeeds", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(answer(503, { error: "restarting" }))
      .mockResolvedValueOnce(answer(200, bundle));

    const result = checkForUpdate();
    await vi.advanceTimersByTimeAsync(10_000);

    await expect(result).resolves.toMatchObject({ kind: "ota", version: "1.6.0" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("gives up after the configured attempts with a NetworkError", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const failure = checkForUpdate().catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(10_000);

    expect(await failure).toBeInstanceOf(NetworkError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("abandons an attempt that outlives the per-attempt timeout, and retries it", async () => {
    configureUpdater({ timeoutMs: 15_000, checkAttempts: 2 });
    fetchMock
      .mockImplementationOnce(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError")),
            );
          }),
      )
      .mockResolvedValueOnce(answer(200, bundle));

    const result = checkForUpdate();
    await vi.advanceTimersByTimeAsync(15_000);
    await vi.advanceTimersByTimeAsync(2_000);

    await expect(result).resolves.toMatchObject({ version: "1.6.0" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a refusal", async () => {
    fetchMock.mockResolvedValue(answer(403, { error: "App disabled" }));

    const refusal = checkForUpdate();

    await expect(refusal).rejects.toBeInstanceOf(HttpError);
    await expect(refusal).rejects.toMatchObject({ status: 403, serverMessage: "App disabled" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("still raises a blocking response as a refusal", async () => {
    fetchMock.mockResolvedValue(
      answer(200, { message: UpdateMessage.CHANNEL_NOT_FOUND, kind: "blocked" }),
    );

    await expect(checkForUpdate()).rejects.toBeInstanceOf(UpdateCheckBlockedError);
  });

  it("asks the runtime channel on every check", async () => {
    mocks.channel = "beta";
    fetchMock.mockResolvedValue(answer(200, { kind: "up_to_date" }));

    await checkForUpdate();

    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({
      channel: "beta",
      versionBuiltin: "1.5.0",
      version_name: "builtin",
    });
  });
});

describe("reportUpdateEvent", () => {
  const update: ResolvedUpdate = { kind: "ota", version: "1.6.0", required: false };

  it("returns at once, before the request has an answer", () => {
    fetchMock.mockReturnValue(new Promise(() => {}));

    expect(reportUpdateEvent("install", update, undefined, { keepalive: true })).toBeUndefined();
  });

  it("sends a keepalive request so it outlives a WebView reload", async () => {
    fetchMock.mockResolvedValue(answer(200, {}));

    reportUpdateEvent("install", update, undefined, { keepalive: true });
    await vi.advanceTimersByTimeAsync(0);

    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ keepalive: true });
  });

  it("swallows a failure", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock.mockRejectedValue(new TypeError("offline"));

    reportUpdateEvent("error", update);
    await vi.advanceTimersByTimeAsync(0);

    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
