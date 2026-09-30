import type { Logger } from "./logger";

/** Work that must not delay a response but must be awaited before shutdown. */
export class BackgroundTasks {
  private readonly pending = new Set<Promise<unknown>>();

  constructor(private readonly logger: Logger) {}

  run(label: string, task: () => Promise<unknown>): void {
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
}
