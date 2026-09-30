import { useMutation, useQuery } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { queryKeys } from "@/shared/api/query-keys";
import { acceptInvitation, fetchInvitation } from "../services/auth.service";
import type { AcceptInvitationInput } from "../types/auth.types";
import { useSessionStart } from "./useSessionStart";

/** The invitation behind a link, and accepting it (which signs the person in). */
export function useInvitation(token: MaybeRefOrGetter<string>) {
  const start = useSessionStart();
  const preview = useQuery({
    queryKey: computed(() => queryKeys.invitation(toValue(token))),
    queryFn: ({ signal }) => fetchInvitation(toValue(token), signal),
    enabled: computed(() => Boolean(toValue(token))),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
  const accept = useMutation({
    mutationFn: (input: Omit<AcceptInvitationInput, "token">) =>
      acceptInvitation({ ...input, token: toValue(token) }),
    onSuccess: start,
  });
  return { preview, accept };
}
