import { SecretBox } from "../lib/secret-box";
import { SignedState } from "../lib/signed-state";

export interface CachedToken {
  token: string;
  expiresAt: number;
}

/**
 * Process-wide state for talking to CI providers: the encryption box, short-lived installation
 * tokens and the throttles. Held in `Deps` rather than module scope so every test gets its own.
 */
export class CiRuntime {
  readonly secrets: SecretBox;
  readonly states: SignedState;
  readonly installationTokens = new Map<string, CachedToken>();
  readonly inflightTokens = new Map<string, Promise<CachedToken>>();
  readonly syncedAt = new Map<string, number>();
  appCache: { value: unknown; expiresAt: number } | null = null;

  constructor(
    secretKey: string,
    readonly fetch: typeof globalThis.fetch = globalThis.fetch.bind(globalThis),
  ) {
    this.secrets = new SecretBox(secretKey);
    this.states = new SignedState(secretKey);
  }

  /** True at most once per `intervalMs` for a key; the throttle behind manual syncs. */
  claim(key: string, now: number, intervalMs: number): boolean {
    const last = this.syncedAt.get(key) ?? 0;
    if (now - last < intervalMs) return false;
    this.syncedAt.set(key, now);
    if (this.syncedAt.size > 5_000) {
      for (const [entry, at] of this.syncedAt)
        if (now - at > intervalMs) this.syncedAt.delete(entry);
    }
    return true;
  }

  forgetApp(): void {
    this.appCache = null;
    this.installationTokens.clear();
    this.inflightTokens.clear();
  }
}
