import type { CiRunRequest } from "@capuchoo/core";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { toValue, type MaybeRefOrGetter } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";
import { queryKeys } from "../../api/query-keys";
import { RouteName } from "../../router/route-names";
import { startCiRun } from "../../services/ci.service";
import type { Build, BuildDetail } from "../../types/build";

/**
 * Starts a run and opens it. The new run is seeded into the list and as an empty detail so the
 * page renders at once; the detail refetches on mount and the stream fills in its jobs. When the
 * provider did not say which run it started, the list is refreshed and the stream brings it.
 */
export function useStartRun(appId: MaybeRefOrGetter<string>) {
  const client = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (request: CiRunRequest) => startCiRun(toValue(appId), request),
    onSuccess: ({ build, html_url }) => {
      const action = html_url
        ? {
            label: build?.source === "gitlab" ? "Open in GitLab" : "Open in GitHub",
            onClick: () => window.open(html_url, "_blank", "noopener,noreferrer"),
          }
        : undefined;
      if (!build) {
        void client.invalidateQueries({ queryKey: queryKeys.builds(toValue(appId)) });
        toast.success("Pipeline requested", {
          description: "It appears in Builds as soon as the provider starts it.",
          action,
        });
        return;
      }
      client.setQueryData<Build[]>(queryKeys.builds(toValue(appId)), (list) =>
        list ? [build, ...list.filter((entry) => entry.id !== build.id)] : list,
      );
      client.setQueryData<BuildDetail>(
        queryKeys.build(build.id),
        (detail) => detail ?? { ...build, events: [], jobs: [], plan: null, children: [] },
      );
      void client.invalidateQueries({ queryKey: queryKeys.build(build.id), refetchType: "none" });
      toast.success("Pipeline started", { description: build.title ?? undefined, action });
      void router.push({ name: RouteName.build, params: { buildId: build.id } });
    },
  });
}
