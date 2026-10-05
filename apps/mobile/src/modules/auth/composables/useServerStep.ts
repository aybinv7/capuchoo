import { api } from "@/shared/api/endpoints";
import { ApiError } from "@/shared/api/http";
import { tick } from "@/shared/utils/native/haptics";
import { useSignInDraft } from "./signInDraft";

/**
 * Step one: is there a Capuchoo server at this address? An unauthenticated `me` answers 401 there,
 * so a 401 is the success; no answer, or any other page, is not one.
 */
export function useServerStep() {
  const { t } = useI18n();
  const draft = useSignInDraft();
  const busy = ref(false);
  const error = ref<string | null>(null);

  const canContinue = computed(() => !busy.value && Boolean(draft.normalised.value));

  watch(draft.endpoint, () => (error.value = null));

  async function check(): Promise<boolean> {
    const server = draft.normalised.value;
    if (!server || busy.value) return false;
    busy.value = true;
    error.value = null;
    try {
      await api.probe(server);
      draft.confirm(server);
      return true;
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) {
        draft.confirm(server);
        tick();
        return true;
      }
      error.value =
        failure instanceof ApiError && failure.offline
          ? t("signIn.errors.unreachable", { server })
          : t("signIn.errors.notCapuchoo", { server });
      return false;
    } finally {
      busy.value = false;
    }
  }

  return { endpoint: draft.endpoint, busy, error, canContinue, check };
}
