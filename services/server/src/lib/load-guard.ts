import { serviceBusy } from "./errors";

/**
 * Caps the device requests one process works on at once. Past the cap a request is answered at
 * once with 503 and a jittered Retry-After, which devices already honour, instead of queueing for
 * a database connection until it times out with a 500 tens of seconds later.
 */
export class LoadGuard {
  private active = 0;
  private shedCount = 0;

  constructor(
    private readonly max: number,
    private readonly random: () => number = Math.random,
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
    throw serviceBusy(2 + Math.floor(this.random() * 4));
  }
}
