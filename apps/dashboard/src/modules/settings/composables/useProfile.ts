import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { queryKeys } from "@/shared/api/query-keys";
import { changePassword, updateProfile } from "../services/account.service";

export function useProfile() {
  const client = useQueryClient();

  const rename = useMutation({
    mutationFn: (fullName: string | null) => updateProfile(fullName),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.me() }),
  });

  const password = useMutation({
    mutationFn: ({ current, next }: { current: string; next: string }) =>
      changePassword(current, next),
  });

  return { rename, password };
}
