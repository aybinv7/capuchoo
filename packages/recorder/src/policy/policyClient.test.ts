import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { DEFAULT_RECORDING_POLICY } from "@capuchoo/core";
import { createPolicyClient } from "./policyClient.js";

let originalFetch: typeof fetch;

beforeEach(() => {
  vi.useFakeTimers();
  originalFetch = window.fetch;
  localStorage.clear();
});
afterEach(() => {
  window.fetch = originalFetch;
  vi.useRealTimers();
});

const policyResponse = () =>
  new Response(
    JSON.stringify({
      policy: { ...DEFAULT_RECORDING_POLICY, version: "v1", liveUntil: null, sampled: true },
      known_assets: [],
    }),
    { headers: { "content-type": "application/json" } },
  );

function client(onPolicy = vi.fn()) {
  return {
    onPolicy,
    policy: createPolicyClient({
      endpoint: "http://server.test",
      request: () => ({
        appId: "com.acme.app",
        deviceId: "d1",
        platform: "android",
        versionName: "1.0.0",
        versionCode: 1,
        channel: "prod",
      }),
      onPolicy,
      onError: () => undefined,
    }),
  };
}

describe("policy client", () => {
  it("gives up on a request that never answers and polls again", async () => {
    let calls = 0;
    window.fetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      calls++;
      if (calls === 1) {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        });
      }
      return Promise.resolve(policyResponse());
    }) as typeof fetch;

    const { policy, onPolicy } = client();
    const started = policy.start();
    await vi.advanceTimersByTimeAsync(15_000);
    await started;
    expect(onPolicy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(30_000);
    expect(calls).toBeGreaterThanOrEqual(2);
    expect(onPolicy).toHaveBeenCalledTimes(1);
    policy.stop();
  });

  it("listens in the foreground, and falls back to polling when the server does not hold", async () => {
    let calls = 0;
    const bodies: Array<Record<string, unknown>> = [];
    window.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls++;
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return policyResponse();
    }) as typeof fetch;

    const { policy, onPolicy } = client();
    await policy.start();
    await vi.advanceTimersByTimeAsync(10);
    expect(bodies[0]!.wait).toBe(0);
    expect(bodies[1]!.wait).toBe(50);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(calls).toBe(2);
    expect(onPolicy).toHaveBeenCalledTimes(1);
    policy.stop();
  });

  it("keeps the last answer for a device that boots offline", async () => {
    window.fetch = vi.fn(async () => policyResponse()) as typeof fetch;
    const first = client();
    await first.policy.start();
    first.policy.stop();

    window.fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as typeof fetch;
    const second = client();
    expect(second.policy.cached?.policy.version).toBe("v1");
    await second.policy.start();
    second.policy.stop();
  });
});
