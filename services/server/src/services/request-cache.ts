interface Entry {
  value: unknown;
  expiresAt: number;
  generation: number;
}

/**
 * Short-lived cache for the device hot path. Entries are grouped by app; any write to an app bumps
 * its generation so a stale entry is never served after this process changed the data.
 */
export class RequestCache {
  private readonly entries = new Map<string, Entry>();
  private readonly generations = new Map<string, number>();

  constructor(
    private readonly ttlMs = 5_000,
    private readonly maxEntries = 10_000,
  ) {}

  async get<T>(scope: string, key: string, load: () => Promise<T>, now = Date.now()): Promise<T> {
    const id = `${scope}\u0000${key}`;
    const generation = this.generations.get(scope) ?? 0;
    const hit = this.entries.get(id);
    if (hit && hit.expiresAt > now && hit.generation === generation) return hit.value as T;
    const value = await load();
    if ((this.generations.get(scope) ?? 0) === generation) {
      this.entries.set(id, { value, expiresAt: now + this.ttlMs, generation });
      if (this.entries.size > this.maxEntries) {
        const oldest = this.entries.keys().next().value;
        if (oldest !== undefined) this.entries.delete(oldest);
      }
    }
    return value;
  }

  invalidate(scope: string): void {
    this.generations.set(scope, (this.generations.get(scope) ?? 0) + 1);
  }

  clear(): void {
    this.entries.clear();
    this.generations.clear();
  }
}
