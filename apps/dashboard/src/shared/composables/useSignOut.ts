import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";
import { errorMessage } from "../api/errors";
import { RouteName } from "../router/route-names";
import { logout } from "../services/session.service";

/** Ends the server session, forgets every cached response, and returns to the sign-in page. */
export function useSignOut() {
  const client = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: logout,
    onError: (error) => toast.error("Sign-out failed", { description: errorMessage(error) }),
    onSuccess: async () => {
      await router.replace({ name: RouteName.login });
      client.clear();
    },
  });
}
