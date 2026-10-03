import {
  parseAssistInvite,
  type AssistInvite,
  type RecordingPolicyRequest,
  type ResolvedRecordingPolicy,
} from "@capuchoo/core";

export interface PolicyAnswer {
  policy: ResolvedRecordingPolicy;
  knownAssets: string[];
}

const RETRY_MIN_MS = 30_000;
const REQUEST_TIMEOUT_MS = 15_000;
/** An "unchanged" answer faster than this means the server did not hold the request; poll instead. */
const MIN_HELD_MS = 2000;
const BACKGROUNDED = "backgrounded";
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
  /** An agent asks to assist; the answer to a held request carries the invite. */
  onAssist?: (invite: AssistInvite) => void;
}) {
  const key = input.request().appId;
  let current: PolicyAnswer | null = read(key);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let fetchedAt = 0;
  let failures = 0;
  let inflight: Promise<void> | null = null;
  let stopped = false;
  let listening: AbortController | null = null;
  /** The invite already handed on, so the server keeps holding the request instead of repeating it. */
  let seenInvite: string | null = null;

  function schedule(delay: number): void {
    if (stopped) return;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => void refresh(), delay);
  }

  /** Held open only in the foreground, where a change is worth hearing at once. */
  function listenWindow(): number {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return 0;
    return current?.policy.listenMs ?? 0;
  }

  async function fetchPolicy(waitMs: number): Promise<void> {
    const controller = new AbortController();
    listening = waitMs > 0 ? controller : null;
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS + waitMs);
    const sentAt = Date.now();
    try {
      const response = await fetch(`${input.endpoint}/api/recording/policy`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...input.request(),
          known: current?.policy.version ?? null,
          wait: waitMs / 1000,
          assist_seen: seenInvite,
        }),
        credentials: "omit",
        signal: controller.signal,
      });
      if (response.status === 404) {
        input.onError("the server does not know this app; recording stays off");
        schedule(current?.policy.pollMs ?? 60 * 60_000);
        return;
      }
      if (!response.ok) throw new Error(`policy request failed with ${response.status}`);
      const body = (await response.json()) as (
        | { unchanged: true; version: string }
        | { policy: ResolvedRecordingPolicy; known_assets: string[] }
      ) & { assist?: unknown };
      fetchedAt = Date.now();
      failures = 0;
      const invite = parseAssistInvite(body.assist);
      const freshInvite = invite !== null && invite.session !== seenInvite;
      if (invite && freshInvite) {
        seenInvite = invite.session;
        input.onAssist?.(invite);
      }
      const changed = !("unchanged" in body) && body.policy.version !== current?.policy.version;
      if (changed) {
        current = { policy: body.policy, knownAssets: body.known_assets ?? [] };
        write(key, current);
        input.onPolicy(current);
      }
      const next = listenWindow();
      const heldOpen = waitMs === 0 || changed || freshInvite || Date.now() - sentAt >= MIN_HELD_MS;
      if (next > 0 && heldOpen) schedule(0);
      else schedule(current?.policy.pollMs ?? 5 * 60_000);
    } catch (error) {
      if (controller.signal.reason === BACKGROUNDED || stopped) return;
      failures++;
      input.onError(error instanceof Error ? error.message : String(error));
      const ceiling = current?.policy.pollMs ?? 5 * 60_000;
      schedule(Math.min(ceiling, RETRY_MIN_MS * 2 ** Math.min(failures - 1, 5)));
    } finally {
      clearTimeout(timeout);
      if (listening === controller) listening = null;
    }
  }

  function refresh(): Promise<void> {
    inflight ??= fetchPolicy(fetchedAt === 0 ? 0 : listenWindow()).finally(() => {
      inflight = null;
    });
    return inflight;
  }

  const onVisible = () => {
    if (document.visibilityState !== "visible") {
      const held = listening;
      listening = null;
      held?.abort(BACKGROUNDED);
      return;
    }
    const age = Date.now() - fetchedAt;
    if (listenWindow() > 0 || age >= (current?.policy.pollMs ?? 5 * 60_000) / 2) void refresh();
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
      listening?.abort(BACKGROUNDED);
      listening = null;
      if (timer !== null) clearTimeout(timer);
      timer = null;
      document.removeEventListener("visibilitychange", onVisible);
    },
  };
}
