import { QueryClient } from "@tanstack/vue-query";
import { isApiError } from "./errors";

const FINAL_STATUSES = new Set([400, 401, 403, 404, 409, 410, 413, 429]);

/** Retries only what a retry can fix: network drops and server errors, twice at most. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  return !(isApiError(error) && FINAL_STATUSES.has(error.status));
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: shouldRetry,
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
  });
}
