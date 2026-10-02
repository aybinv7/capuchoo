import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { queryKeys } from "@/shared/api/query-keys";
import { useWorkspaceStore } from "@/shared/stores/workspace.store";
import { fetchDemo, seedDemo } from "../services/demo.service";

/**
 * The demo organization: whether it exists and whether the server allows seeding it, and the
 * seed itself. A seed replaces the organization, so the session (organizations, apps) and every
 * app-scoped query are refetched and the switcher moves to the new organization.
 */
export function useDemo() {
  const client = useQueryClient();
  const workspace = useWorkspaceStore();

  const status = useQuery({
    queryKey: queryKeys.demo(),
    queryFn: ({ signal }) => fetchDemo(signal),
    staleTime: 30_000,
  });

  const seed = useMutation({
    mutationFn: seedDemo,
    onSuccess: async (result) => {
      workspace.selectOrganization(result.organization_id);
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.me() }),
        client.invalidateQueries({ queryKey: queryKeys.demo() }),
        client.invalidateQueries({ queryKey: ["apps"] }),
      ]);
    },
  });

  return { status, seed };
}
