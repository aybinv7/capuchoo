import { api } from "@/shared/api/endpoints";
import { ApiError } from "@/shared/api/http";
import { saveSession } from "@/shared/session/session";
import { bump } from "@/shared/utils/native/haptics";

const LAST_ENDPOINT = "capuchoo.lastEndpoint";

/** `updates.example.com` becomes `https://updates.example.com`; a trailing slash is dropped. */
export function normaliseEndpoint(value: string): string | null {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    return url.hostname ? `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, "")}` : null;
  } catch {
    return null;
  }
}

export function useSignIn() {
  const { t } = useI18n();
  const endpoint = ref(
    localStorage.getItem(LAST_ENDPOINT) ?? import.meta.env.VITE_DEFAULT_ENDPOINT ?? "",
  );
  const email = ref("");
  const password = ref("");
  const busy = ref(false);
  const error = ref<string | null>(null);

  const canSubmit = computed(
    () =>
      !busy.value &&
      Boolean(normaliseEndpoint(endpoint.value)) &&
      email.value.includes("@") &&
      password.value.length > 0,
  );

  function describe(failure: unknown, server: string): string {
    if (failure instanceof ApiError) {
      if (failure.offline) return t("signIn.errors.offline", { server });
      if (failure.status === 401) return t("signIn.errors.credentials");
      if (failure.status === 429) return t("signIn.errors.rateLimited");
      return failure.message;
    }
    return failure instanceof Error ? failure.message : String(failure);
  }

  async function submit(): Promise<boolean> {
    const server = normaliseEndpoint(endpoint.value);
    if (!server || !canSubmit.value) return false;
    busy.value = true;
    error.value = null;
    try {
      const response = await api.login(server, email.value.trim(), password.value);
      localStorage.setItem(LAST_ENDPOINT, server);
      await saveSession({
        endpoint: server,
        token: response.token,
        email: response.user.email,
        expiresAt: response.expires_at,
      });
      password.value = "";
      bump();
      return true;
    } catch (failure) {
      error.value = describe(failure, server);
      return false;
    } finally {
      busy.value = false;
    }
  }

  return { endpoint, email, password, busy, error, canSubmit, submit };
}
