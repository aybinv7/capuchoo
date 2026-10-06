/** Runs `run` later with a time budget in milliseconds; the returned function cancels it. */
export type SliceScheduler = (run: (budgetMs: number) => void) => () => void;

interface PostTaskScheduler {
  postTask(
    callback: () => void,
    options: { priority: "background"; signal: AbortSignal },
  ): Promise<unknown>;
}

/** Long enough to make progress, short enough that a tap waits at most this long for its handler. */
export const SLICE_MS = 8;

function postTaskScheduler(): PostTaskScheduler | null {
  const candidate = (globalThis as { scheduler?: Partial<PostTaskScheduler> }).scheduler;
  return typeof candidate?.postTask === "function" ? (candidate as PostTaskScheduler) : null;
}

/**
 * Background work in short tasks. `scheduler.postTask` at background priority where the WebView
 * has it (Chromium 94+): it yields to input and rendering but, unlike `requestIdleCallback`, may run
 * one task after another, so a snapshot of a large page finishes in about the time its work takes.
 * Elsewhere (WKWebView) a zero-delay timeout, which still lets input and frames in between.
 */
export function backgroundSlices(sliceMs = SLICE_MS): SliceScheduler {
  const scheduler = postTaskScheduler();
  if (scheduler) {
    return (run) => {
      const controller = new AbortController();
      scheduler
        .postTask(() => run(sliceMs), { priority: "background", signal: controller.signal })
        .catch(() => undefined);
      return () => controller.abort();
    };
  }
  return (run) => {
    const id = setTimeout(() => run(sliceMs), 0);
    return () => clearTimeout(id);
  };
}
