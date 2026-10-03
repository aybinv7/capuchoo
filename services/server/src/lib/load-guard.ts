import type { Config } from "../config";
import { serviceBusy } from "./errors";
import type { Logger } from "./logger";

const REPORT_INTERVAL_MS = 10_000;

/**
 * Measured on one process: with 64 requests in flight for a pool of 30, accepted requests kept a
 * p99 under 450 ms at twice the throughput the process can serve; with 256 they queued for seconds.
 * So the cap follows the pool rather than a fixed number.
 */
export function deviceInflightCap(
  config: Pick<Config, "DEVICE_MAX_INFLIGHT" | "DATABASE_POOL_MAX">,
): number {
  return config.DEVICE_MAX_INFLIGHT ?? Math.max(32, config.DATABASE_POOL_MAX * 2);
}

/**
 * Caps the device requests one process works on at once. Past the cap a request is answered at
 * once with 503 and a jittered Retry-After, which devices already honour, instead of queueing for
 * a database connection until it times out with a 500 tens of seconds later.
 */
export class LoadGuard {
  private active = 0;
  private shedCount = 0;
  private unreported = 0;
  private reportedAt = 0;

  constructor(
    private readonly max: number,
    private readonly random: () => number = Math.random,
    private readonly logger: Logger | null = null,
  ) {}

  get inflight(): number {
    return this.active;
  }

  get shed(): number {
    return this.shedCount;
  }

  /** Refuses when saturated without holding a slot: for requests that mostly wait, not work. */
  check(): void {
    if (this.active >= this.max) this.refuse();
  }

  /** Runs `work` in a slot, or refuses with 503 when none is free. */
  async run<T>(work: () => Promise<T>): Promise<T> {
    this.check();
    this.active++;
    try {
      return await work();
    } finally {
      this.active--;
    }
  }

  private refuse(): never {
    this.shedCount++;
    this.unreported++;
    const now = Date.now();
    if (this.logger && now - this.reportedAt >= REPORT_INTERVAL_MS) {
      this.logger.warn("shedding device requests", {
        shed: this.unreported,
        inflight: this.active,
        cap: this.max,
      });
      this.reportedAt = now;
      this.unreported = 0;
    }
    throw serviceBusy(2 + Math.floor(this.random() * 4));
  }
}
