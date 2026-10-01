import { openDatabase } from "@/shared/database";

const OPEN_TIMEOUT_MS = 10_000;

/**
 * Opening the database is the one thing that must succeed before the first screen renders, and the
 * one thing that used to fail silently: awaited at the top level of `main.ts`, a rejection left an
 * empty `#app` and nothing in the console. The timeout turns a hang into a message.
 */
export async function sqlitePlugin(): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      openDatabase(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(`opening the database did not finish in ${String(OPEN_TIMEOUT_MS)}ms`),
            ),
          OPEN_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    // Losing the race does not stop the timer, which then held the event loop for the full timeout
    // after a fast open. The walk itself is not cancellable, but `openDatabase` memoises it, so a
    // retry joins the attempt already running instead of racing it for the same OPFS directory.
    clearTimeout(timer);
  }
}
