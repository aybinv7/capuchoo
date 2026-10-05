import { api } from "@/shared/api/endpoints";
import { ApiError } from "@/shared/api/http";
import { saveSession } from "@/shared/session/session";
import { bump } from "@/shared/utils/native/haptics";
import { useSignInDraft } from "./signInDraft";

/** Step two: the account on the server step one confirmed. */
export function useAccountStep() {
  const { t } = useI18n();
  const draft = useSignInDraft();
  const email = ref("");
  const password = ref("");
  const busy = ref(false);
  const error = ref<string | null>(null);

  const server = computed(() => draft.confirmed.value);
  const canSubmit = computed(
    () =>
      !busy.value &&
      Boolean(server.value) &&
      email.value.includes("@") &&
      password.value.length > 0,
  );

  watch([email, password], () => (error.value = null));

  function describe(failure: unknown, host: string): string {
    if (failure instanceof ApiError) {
      if (failure.offline) return t("signIn.errors.offline", { server: host });
      if (failure.status === 401) return t("signIn.errors.credentials");
      if (failure.status === 429) return t("signIn.errors.rateLimited");
      return failure.message;
    }
    return failure instanceof Error ? failure.message : String(failure);
  }

  async function submit(): Promise<boolean> {
    const endpoint = server.value;
    if (!endpoint || !canSubmit.value) return false;
    busy.value = true;
    error.value = null;
    try {
      const response = await api.login(endpoint, email.value.trim(), password.value);
      draft.remember(endpoint);
      password.value = "";
      bump();
      await saveSession({
        endpoint,
        token: response.token,
        email: response.user.email,
        expiresAt: response.expires_at,
      });
      return true;
    } catch (failure) {
      error.value = describe(failure, endpoint);
      return false;
    } finally {
      busy.value = false;
    }
  }

  return { server, email, password, busy, error, canSubmit, submit };
}
