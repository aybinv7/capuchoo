import { useMutation } from "@tanstack/vue-query";
import { login } from "../services/auth.service";
import type { Credentials } from "../types/auth.types";
import { useSessionStart } from "./useSessionStart";

export function useLogin() {
  const start = useSessionStart();
  return useMutation({
    mutationFn: (credentials: Credentials) => login(credentials),
    onSuccess: start,
  });
}
