import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { toValue, type MaybeRefOrGetter } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";
import { queryKeys } from "@/shared/api/query-keys";
import { notifyError } from "@/shared/lib/notify";
import { RouteName } from "@/shared/router/route-names";
import { cancelBuild, rerunBuild, syncBuild } from "@/shared/services/insight.service";
import type { Build, BuildDetail } from "@/shared/types/build";
import { reconcileDetail } from "../lib/reconcile";

function stripDetail({
  events: _events,
  jobs: _jobs,
  plan: _plan,
  children: _children,
  ...build
}: BuildDetail): Build {
  return build;
}

/**
 * Cancel, re-run and sync for one run. Each answer is folded into the cached detail and list at
 * once; a re-run the provider gave a new id opens that run instead.
 */
export function useBuildActions(buildId: MaybeRefOrGetter<string>) {
  const client = useQueryClient();
  const router = useRouter();

  function merge(build: Build | null) {
    if (!build) return;
    client.setQueryData<BuildDetail>(queryKeys.build(build.id), (detail) =>
      detail
        ? {
            ...detail,
            ...build,
            events: detail.events,
            jobs: detail.jobs,
            plan: detail.plan,
            children: detail.children,
          }
        : detail,
    );
    client.setQueryData<Build[]>(queryKeys.builds(build.app_id), (list) =>
      list?.map((entry) => (entry.id === build.id ? { ...entry, ...build } : entry)),
    );
  }

  const cancel = useMutation({
    mutationFn: () => cancelBuild(toValue(buildId)),
    onSuccess: (build) => {
      merge(build);
      toast.success("Cancellation requested", {
        description: "The provider stops the running jobs; the graph follows.",
      });
    },
    onError: notifyError,
  });

  const rerun = useMutation({
    mutationFn: (failedOnly: boolean) => rerunBuild(toValue(buildId), failedOnly),
    onSuccess: (build, failedOnly) => {
      merge(build);
      void client.invalidateQueries({ queryKey: queryKeys.build(toValue(buildId)) });
      toast.success(failedOnly ? "Re-running failed jobs" : "Re-running the whole run");
      if (build && build.id !== toValue(buildId))
        void router.push({ name: RouteName.build, params: { buildId: build.id } });
    },
    onError: notifyError,
  });

  const sync = useMutation({
    mutationFn: () => syncBuild(toValue(buildId)),
    onSuccess: (detail) => {
      client.setQueryData<BuildDetail>(queryKeys.build(detail.id), (current) =>
        reconcileDetail(current, detail),
      );
      client.setQueryData<Build[]>(queryKeys.builds(detail.app_id), (list) =>
        list?.map((entry) =>
          entry.id === detail.id ? { ...entry, ...stripDetail(detail) } : entry,
        ),
      );
    },
  });

  return { cancel, rerun, sync };
}
