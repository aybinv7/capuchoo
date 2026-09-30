import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { backoffDelay, withRetry, type RetryPolicy } from "./retry.js";

const policy: RetryPolicy = { attempts: 3, baseDelayMs: 1_000, maxDelayMs: 10_000 };

describe("backoffDelay", () => {
  it("doubles, with jitter between half and all of the ceiling", () => {
    expect(backoffDelay(0, policy, () => 0)).toBe(500);
    expect(backoffDelay(0, policy, () => 1)).toBe(1_000);
    expect(backoffDelay(1, policy, () => 0)).toBe(1_000);
    expect(backoffDelay(2, policy, () => 1)).toBe(4_000);
  });

  it("never exceeds the ceiling", () => {
    expect(backoffDelay(20, policy, () => 1)).toBe(10_000);
  });
});

describe("withRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retries a retryable failure after the backoff, then succeeds", async () => {
    const task = vi
      .fn<(attempt: number) => Promise<string>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce("ok");

    const result = withRetry(task, { policy, shouldRetry: () => true, random: () => 0 });

    await vi.advanceTimersByTimeAsync(499);
    expect(task).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);

    await expect(result).resolves.toBe("ok");
    expect(task).toHaveBeenCalledTimes(2);
  });

  it("gives up after the last attempt with the last error", async () => {
    let calls = 0;
    const task = () => Promise.reject(new Error(`fail ${++calls}`));

    const failure = withRetry(task, { policy, shouldRetry: () => true, random: () => 1 }).catch(
      (error: unknown) => error,
    );
    await vi.advanceTimersByTimeAsync(3_000);

    expect(await failure).toMatchObject({ message: "fail 3" });
    expect(calls).toBe(3);
  });

  it("rethrows at once when the failure is not retryable", async () => {
    const task = vi.fn<() => Promise<never>>(() => Promise.reject(new Error("refused")));

    await expect(withRetry(task, { policy, shouldRetry: () => false })).rejects.toThrow("refused");
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("always makes at least one attempt", async () => {
    const task = vi.fn<() => Promise<number>>(() => Promise.resolve(1));

    await withRetry(task, { policy: { ...policy, attempts: 0 }, shouldRetry: () => true });
    expect(task).toHaveBeenCalledTimes(1);
  });
});
