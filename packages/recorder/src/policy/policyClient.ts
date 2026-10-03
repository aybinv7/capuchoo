import type { RecordingPolicyRequest, ResolvedRecordingPolicy } from "@capuchoo/core";

export interface PolicyAnswer {
  policy: ResolvedRecordingPolicy;
  knownAssets: string[];
}

const RETRY_MIN_MS = 30_000;
const STORAGE_PREFIX = "capuchoo.recorder.policy:";

function read(key: string): PolicyAnswer | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw ? (JSON.parse(raw) as PolicyAnswer) : null;
  } catch {
    return null;
  }
}

function write(key: string, answer: PolicyAnswer): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(answer));
  } catch {
    return;
  }
}

/**
 * Asks the server what to record, on start, every `pollMs`, and when the app comes back to the
 * foreground after that long. The last answer is kept so a device that boots offline still buffers.
 */
export function createPolicyClient(input: {
  endpoint: string;
  request: () => Omit<RecordingPolicyRequest, "known">;
  onPolicy: (answer: PolicyAnswer) => void;
  onError: (message: string) => void;
}) {
  const key = input.request().appId;
  let current: PolicyAnswer | null = read(key);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let fetchedAt = 0;
  let failures = 0;
  let inflight: Promise<void> | null = null;
  let stopped = false;

  function schedule(delay: number): void {
    if (stopped) return;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => void refresh(), delay);
  }

  async function fetchPolicy(): Promise<void> {
    try {
      const response = await fetch(`${input.endpoint}/api/recording/policy`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...input.request(), known: current?.policy.version ?? null }),
        credentials: "omit",
      });
      if (response.status === 404) {
        input.onError("the server does not know this app; recording stays off");
        schedule(current?.policy.pollMs ?? 60 * 60_000);
        return;
      }
      if (!response.ok) throw new Error(`policy request failed with ${response.status}`);
      const body = (await response.json()) as
        | { unchanged: true; version: string }
        | { policy: ResolvedRecordingPolicy; known_assets: string[] };
      fetchedAt = Date.now();
      failures = 0;
      if (!("unchanged" in body)) {
        current = { policy: body.policy, knownAssets: body.known_assets ?? [] };
        write(key, current);
        input.onPolicy(current);
      }
      schedule(current?.policy.pollMs ?? 5 * 60_000);
    } catch (error) {
      failures++;
      input.onError(error instanceof Error ? error.message : String(error));
      const ceiling = current?.policy.pollMs ?? 5 * 60_000;
      schedule(Math.min(ceiling, RETRY_MIN_MS * 2 ** Math.min(failures - 1, 5)));
    }
  }

  function refresh(): Promise<void> {
    inflight ??= fetchPolicy().finally(() => {
      inflight = null;
    });
    return inflight;
  }

  const onVisible = () => {
    if (document.visibilityState !== "visible") return;
    const age = Date.now() - fetchedAt;
    if (age >= (current?.policy.pollMs ?? 5 * 60_000) / 2) void refresh();
  };

  return {
    get cached(): PolicyAnswer | null {
      return current;
    },
    start(): Promise<void> {
      stopped = false;
      document.addEventListener("visibilitychange", onVisible);
      return refresh();
    },
    refresh,
    stop(): void {
      stopped = true;
      if (timer !== null) clearTimeout(timer);
      timer = null;
      document.removeEventListener("visibilitychange", onVisible);
    },
  };
}
