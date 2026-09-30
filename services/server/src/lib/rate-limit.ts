interface Bucket {
  tokens: number;
  updatedAt: number;
}

/** In-process token bucket keyed by caller; bounded so a flood of keys cannot exhaust memory. */
export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
    private readonly maxKeys = 50_000,
  ) {}

  /** Returns 0 when allowed, otherwise the seconds to wait. */
  take(key: string, now = Date.now()): number {
    const bucket = this.buckets.get(key) ?? { tokens: this.capacity, updatedAt: now };
    const elapsed = Math.max(0, (now - bucket.updatedAt) / 1000);
    bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsed * this.refillPerSecond);
    bucket.updatedAt = now;
    this.buckets.delete(key);
    this.buckets.set(key, bucket);
    if (this.buckets.size > this.maxKeys) {
      const oldest = this.buckets.keys().next().value;
      if (oldest !== undefined) this.buckets.delete(oldest);
    }
    if (bucket.tokens < 1) return Math.ceil((1 - bucket.tokens) / this.refillPerSecond);
    bucket.tokens -= 1;
    return 0;
  }
}
