import { normaliseEndpoint } from "../lib/endpoint";

const LAST_ENDPOINT = "capuchoo.lastEndpoint";

/**
 * What the two sign-in steps share: the server the first one checked. Module state, because the
 * steps are two pages and the second must not ask again.
 */
const endpoint = ref(
  localStorage.getItem(LAST_ENDPOINT) ?? import.meta.env.VITE_DEFAULT_ENDPOINT ?? "",
);
const confirmed = ref<string | null>(null);

export function useSignInDraft() {
  return {
    endpoint,
    confirmed: readonly(confirmed),
    confirm(server: string): void {
      confirmed.value = server;
      endpoint.value = server;
    },
    remember(server: string): void {
      localStorage.setItem(LAST_ENDPOINT, server);
    },
    normalised: computed(() => normaliseEndpoint(endpoint.value)),
  };
}
