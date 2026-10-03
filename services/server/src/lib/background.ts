import type { Logger } from "./logger";

const DROP_LOG_INTERVAL_MS = 10_000;

/** Work that must not delay a response but must be awaited before shutdown. */
export class BackgroundTasks {
  private readonly pending = new Set<Promise<unknown>>();
  private droppedCount = 0;
  private reportedAt = 0;
  private unreported = 0;

  constructor(
    private readonly logger: Logger,
    private readonly limit = Number.POSITIVE_INFINITY,
  ) {}

  /**
   * A `droppable` task is skipped while `limit` tasks are pending: best-effort writes such as
   * device telemetry must not queue behind each other for database connections live requests need.
   */
  run(label: string, task: () => Promise<unknown>, options: { droppable?: boolean } = {}): void {
    if (options.droppable && this.pending.size >= this.limit) {
      this.drop(label);
      return;
    }
    const promise = task()
      .catch((error: unknown) => this.logger.warn(`${label} failed`, { error }))
      .finally(() => this.pending.delete(promise));
    this.pending.add(promise);
  }

  async idle(): Promise<void> {
    while (this.pending.size > 0) await Promise.allSettled(this.pending);
  }

  get size(): number {
    return this.pending.size;
  }

  get dropped(): number {
    return this.droppedCount;
  }

  private drop(label: string): void {
    this.droppedCount++;
    this.unreported++;
    const now = Date.now();
    if (now - this.reportedAt < DROP_LOG_INTERVAL_MS) return;
    this.logger.warn("background tasks dropped under load", {
      label,
      dropped: this.unreported,
      pending: this.pending.size,
    });
    this.reportedAt = now;
    this.unreported = 0;
  }
}
