import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { queryKeys } from "@/shared/api/query-keys";
import {
  createGithubManifest,
  deleteGithubApp,
  fetchGithubApp,
  type ManifestInput,
} from "../services/ci-settings.service";

/** The instance's GitHub App: its status, the manifest that creates it, and removing it. */
export function useGithubApp() {
  const client = useQueryClient();
  const status = useQuery({
    queryKey: queryKeys.githubApp(),
    queryFn: ({ signal }) => fetchGithubApp(signal),
    staleTime: 60_000,
  });

  const manifest = useMutation({
    mutationFn: (input: ManifestInput) => createGithubManifest(input),
  });

  const remove = useMutation({
    mutationFn: () => deleteGithubApp(),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.githubApp() }),
  });

  return { status, manifest, remove };
}
