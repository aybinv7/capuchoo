import { HttpError } from "../utils/http.js";

/** The stdout document for a failed `--json` run: the message, plus the server's refusal code. */
export function jsonFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const reason = error instanceof HttpError ? error.reason : null;
  const status = error instanceof HttpError ? error.status : null;
  return JSON.stringify({ ok: false, error: message, reason, status }, null, 2);
}

/** Runs `work`; under `--json` a failure becomes a JSON document on stdout and exit code 1. */
export async function withJsonFailure<T>(
  json: boolean,
  log: (line: string) => void,
  work: () => Promise<T>,
): Promise<T | undefined> {
  if (!json) return work();
  try {
    return await work();
  } catch (error) {
    log(jsonFailure(error));
    process.exitCode = 1;
    return undefined;
  }
}
