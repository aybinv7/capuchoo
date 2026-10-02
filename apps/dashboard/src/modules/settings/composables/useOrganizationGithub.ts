import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { queryKeys } from "@/shared/api/query-keys";
import {
  fetchInstallUrl,
  fetchOrganizationGithub,
  unlinkInstallation,
} from "../services/ci-settings.service";

/**
 * An organization's GitHub installations. Installing is a full-page trip to GitHub that comes
 * back to `returnPath` with `?github=linked` or `?github_error=`.
 */
export function useOrganizationGithub(organizationId: MaybeRefOrGetter<string>) {
  const client = useQueryClient();
  const id = () => toValue(organizationId);
  const key = computed(() => queryKeys.organization(id(), "github"));

  const github = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => fetchOrganizationGithub(id(), signal),
    enabled: computed(() => Boolean(id())),
  });

  const install = useMutation({
    mutationFn: (returnPath: string) => fetchInstallUrl(id(), returnPath),
    onSuccess: ({ url }) => window.location.assign(url),
  });

  const unlink = useMutation({
    mutationFn: (installationId: string) => unlinkInstallation(id(), installationId),
    onSuccess: () => client.invalidateQueries({ queryKey: key.value }),
  });

  return { github, install, unlink };
}
