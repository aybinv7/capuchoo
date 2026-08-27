/**
 * Publishing, and then waiting until a device has actually taken the update.
 *
 * The last step of onboarding, and the only one that produces evidence rather
 * than a claim. Everything before it checks configuration; this checks that a
 * real install asked this backend for an update and was given the bundle that
 * was just published.
 *
 * Capgo ends its `init` the same way - `upload_bundle` then `test_update` in
 * `@capgo/cli@8.42.3`'s declared step list - and for the same reason: an
 * onboarding that reports success without one device having updated has proven
 * nothing about the part that matters.
 */

export interface UpdateLogRow {
  action?: string | null;
  new_version?: string | null;
  device_id?: string | null;
  created_at?: string | null;
}

export interface Adoption {
  /** Distinct devices served this exact version. */
  devices: number;
  /** When the first one took it. */
  firstAt: string | null;
}

/**
 * Which devices took `version`, from the update log.
 *
 * `action: "get"` is the row the backend writes when it hands a bundle to a
 * device, so it is the earliest honest evidence of delivery - `download` and
 * `install` come later and only if the device reports them.
 *
 * Distinct by device, because one install re-checking is one device, and a count
 * of rows would let a single phone in a polling loop look like a rollout.
 */
export function summariseAdoption(logs: UpdateLogRow[], version: string): Adoption {
  const relevant = logs.filter(
    (row) => row.new_version === version && (row.action ?? "get") === "get",
  );

  const devices = new Set(relevant.map((row) => row.device_id ?? "unknown"));
  const times = relevant
    .map((row) => row.created_at)
    .filter((at): at is string => typeof at === "string")
    .sort();

  return { devices: devices.size, firstAt: times[0] ?? null };
}

export function hasLanded(logs: UpdateLogRow[], version: string): boolean {
  return summariseAdoption(logs, version).devices > 0;
}

export interface WaitOptions {
  /** Give up after this long. */
  timeoutMs: number;
  /** How often to ask. */
  pollMs: number;
  /** Called once per attempt, so the caller can show progress. */
  onAttempt?: ((elapsedMs: number) => void) | undefined;
  /** Injectable for tests. */
  now?: (() => number) | undefined;
  sleep?: ((ms: number) => Promise<void>) | undefined;
}

/**
 * Polls until a device takes the version, or the budget runs out.
 *
 * A timeout is not a failure of the update - it means no device asked while we
 * were watching, which is the normal case when nothing is running. The caller
 * says so rather than reporting a broken deploy.
 */
export async function waitForAdoption(
  fetchLogs: () => Promise<UpdateLogRow[]>,
  version: string,
  options: WaitOptions,
): Promise<{ adopted: boolean; adoption: Adoption }> {
  const now = options.now ?? (() => Date.now());
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  const started = now();
  let adoption: Adoption = { devices: 0, firstAt: null };

  for (;;) {
    const elapsed = now() - started;
    options.onAttempt?.(elapsed);

    // Failures are not fatal: a sleeping backend returning 502 once should not
    // end the wait, and the timeout is the real bound.
    const logs = await fetchLogs().catch(() => [] as UpdateLogRow[]);
    adoption = summariseAdoption(logs, version);

    if (adoption.devices > 0) return { adopted: true, adoption };
    if (now() - started + options.pollMs > options.timeoutMs) {
      return { adopted: false, adoption };
    }

    await sleep(options.pollMs);
  }
}
