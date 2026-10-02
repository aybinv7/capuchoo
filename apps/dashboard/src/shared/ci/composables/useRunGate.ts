import { computed } from "vue";
import { useCurrentApp } from "../../composables/useCurrentApp";
import { useAppCi } from "../../queries/useAppCi";
import { hasAppRole } from "../../lib/roles";

/**
 * Whether the current app can start a pipeline from the dashboard, and why not. The server
 * decides; this only chooses what to offer and how to explain its absence.
 */
export function useRunGate() {
  const { appId, role } = useCurrentApp();
  const query = useAppCi(appId);

  const reason = computed<string | null>(() => {
    if (!hasAppRole(role.value, "developer"))
      return `Starting a pipeline requires developer; you are ${role.value ?? "not a member"}.`;
    if (query.isPending.value) return "Checking the CI connection…";
    if (query.error.value) return "The CI connection could not be read. Reload to retry.";
    const ci = query.ci.value;
    if (!ci?.provider)
      return "Connect a GitHub repository or a GitLab project in CI settings to start pipelines from here.";
    if (ci.can_run) return null;
    if (ci.provider === "gitlab")
      return "Add a GitLab project access token in CI settings to start pipelines from here.";
    return "Finish the GitHub setup in CI settings: the workflow has to be on the default branch.";
  });

  return {
    ci: query.ci,
    pending: computed(() => query.isPending.value),
    allowed: computed(() => reason.value === null),
    reason,
    canConfigure: computed(() => hasAppRole(role.value, "admin")),
  };
}
