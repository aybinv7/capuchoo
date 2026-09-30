export interface RetryPolicy {
  /** Total attempts, including the first. */
  attempts: number;
  /** Delay before the second attempt; doubles for each one after. */
  baseDelayMs: number;
  /** Ceiling for any single delay. */
  maxDelayMs: number;
}

export interface RetryOptions {
  policy: RetryPolicy;
  /** Whether a failure is worth another attempt. A false answer rethrows at once. */
  shouldRetry: (error: unknown) => boolean;
  /** Injected for tests; defaults to `Math.random`. */
  random?: () => number;
}

/**
 * Delay before retry number `retry` (0-based): exponential with equal jitter,
 * so devices that failed together do not all come back together, and no delay
 * collapses to zero.
 */
export function backoffDelay(
  retry: number,
  policy: RetryPolicy,
  random: () => number = Math.random,
): number {
  const ceiling = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** retry);
  const half = ceiling / 2;
  return Math.round(half + random() * half);
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Runs `task` until it succeeds, the policy is spent, or a failure is not retryable. */
export async function withRetry<T>(
  task: (attempt: number) => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const attempts = Math.max(1, Math.floor(options.policy.attempts));

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await task(attempt);
    } catch (error) {
      if (attempt + 1 >= attempts || !options.shouldRetry(error)) throw error;
      await sleep(backoffDelay(attempt, options.policy, options.random));
    }
  }
}
