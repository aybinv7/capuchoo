import { useDocumentVisibility } from "@vueuse/core";
import { onScopeDispose, watch, type Ref } from "vue";

const QUIET_MS = 20_000;
const MIN_INTERVAL_MS = 15_000;

export interface PipelineSyncOptions {
  /** The run is still going; nothing is synced once it ends. */
  active: Readonly<Ref<boolean>>;
  /** When the cached run last changed, by the stream or by a fetch. */
  lastTouched: Readonly<Ref<number>>;
  pending: Readonly<Ref<boolean>>;
  sync: () => Promise<unknown>;
}

/**
 * The safety net for missed webhooks: while a run is active, visible and nothing has touched it
 * for 20 s, ask the server to read it back from the provider - at most every 15 s. One timer,
 * re-armed on every change, cleared on unmount, when the tab hides or when the run ends.
 */
export function usePipelineSync(options: PipelineSyncOptions): void {
  const visibility = useDocumentVisibility();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastSyncAt = 0;

  function schedule() {
    clearTimeout(timer);
    if (!options.active.value || visibility.value !== "visible") return;
    const now = Date.now();
    const wait = Math.max(
      QUIET_MS - (now - options.lastTouched.value),
      MIN_INTERVAL_MS - (now - lastSyncAt),
      0,
    );
    timer = setTimeout(run, wait);
  }

  async function run() {
    if (!options.active.value || visibility.value !== "visible") return;
    lastSyncAt = Date.now();
    if (!options.pending.value) {
      try {
        await options.sync();
      } catch {
        lastSyncAt = Date.now();
      }
    }
    schedule();
  }

  watch([options.active, options.lastTouched, visibility], schedule, { immediate: true });
  onScopeDispose(() => clearTimeout(timer));
}
